// PDF rendering of spell cards with jsPDF. All measures are in millimetres.

const PT = 0.352778; // mm per typographic point
const PAGE = { w: 210, h: 297 };
export const CARD = { w: 63, h: 88 }; // Standard poker / Magic / Pokémon card size
const COLS = 3;
const ROWS = 3;
const PER_PAGE = COLS * ROWS;

const FRAME = 2.2; // coloured frame around the card
const PAD = 1.4; // inner padding
const INNER_W = CARD.w - 2 * FRAME;
const CONTENT_W = INNER_W - 2 * PAD;
const ART_H = 24;
const PX_PER_MM = 12; // ~300 dpi

// Artwork box on the card, in millimetres and in pixels for a sharp print.
export const ART_SIZE = {
  mmW: CONTENT_W,
  mmH: ART_H,
  minW: Math.round(CONTENT_W * PX_PER_MM),
  minH: Math.round(ART_H * PX_PER_MM),
  bestW: Math.ceil((CONTENT_W * PX_PER_MM * 2) / 10) * 10,
  bestH: Math.ceil((ART_H * PX_PER_MM * 2) / 10) * 10,
};
const INK_COLOR = [34, 28, 24];

const mix = (c, t) => c.map((v) => Math.round(v + (255 - v) * t));
const toGray = (c) => {
  const l = Math.round(0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]);
  return [l, l, l];
};

// ---------- Images ----------

const PROXY = 'https://images.weserv.nl/?url=';

function baseName(src) {
  return decodeURIComponent(src.split(/[?#]/)[0].split('/').pop() || '').toLowerCase();
}

async function fetchBlob(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  if (blob.type && !blob.type.startsWith('image/') && blob.type !== 'application/octet-stream') {
    throw new Error(`not an image (${blob.type})`);
  }
  return blob;
}

async function getImageBlob(src, opts) {
  const local = opts.localImages && opts.localImages.get(baseName(src));
  if (local) return local;
  // A bare file name refers to a local image: never look it up on the network.
  if (!/[/:]/.test(src)) throw new Error('local file not loaded');
  try {
    return await fetchBlob(src);
  } catch (err) {
    const absolute = new URL(src, document.baseURI);
    const external = /^https?:$/.test(absolute.protocol) && absolute.origin !== location.origin;
    if (!opts.proxy || !external) throw err;
    return fetchBlob(`${PROXY}${encodeURIComponent(absolute.href)}&w=1400&output=jpg`);
  }
}

function decodeImage(blob) {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable image'));
    };
    img.src = url;
  });
}

// Crops the image to the art box ("cover") and returns a JPEG data URL.
async function loadArt(src, focus, opts) {
  const blob = await getImageBlob(src, opts);
  const { img, url } = await decodeImage(blob);
  try {
    const w = ART_SIZE.minW;
    const h = ART_SIZE.minH;
    const iw = img.naturalWidth || img.width || w;
    const ih = img.naturalHeight || img.height || h;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) * focus, dw, dh);
    if (opts.grayscale) {
      const px = ctx.getImageData(0, 0, w, h);
      const d = px.data;
      for (let i = 0; i < d.length; i += 4) {
        const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
        d[i] = l;
        d[i + 1] = l;
        d[i + 2] = l;
      }
      ctx.putImageData(px, 0, 0);
    }
    return canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function preloadImages(cards, opts, warnings, onProgress) {
  const jobs = new Map();
  for (const c of cards) {
    if (c.image) jobs.set(`${c.image}|${c.imageFocus}`, c);
  }
  const images = new Map();
  let done = 0;
  const total = jobs.size;
  onProgress?.(done, total);
  const queue = [...jobs.entries()];
  const worker = async () => {
    while (queue.length) {
      const [key, card] = queue.shift();
      try {
        images.set(key, { data: await loadArt(card.image, card.imageFocus, opts), alias: `art${images.size}` });
      } catch (err) {
        warnings.push({ code: 'w_image', name: card.name, detail: err.message || String(err) });
      }
      onProgress?.(++done, total);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, total) }, worker));
  return images;
}

// ---------- Rich text ----------

// Splits text into paragraphs of styled runs. Supports **bold**, *italic*, ***both*** and "- " bullets.
function parseRich(text) {
  return String(text).replace(/\r\n?/g, '\n').split('\n').map((rawLine) => {
    let line = rawLine.trim();
    let bullet = false;
    if (/^[-*•]\s+/.test(line)) {
      bullet = true;
      line = line.replace(/^[-*•]\s+/, '');
    }
    const runs = [];
    let bold = false;
    let italic = false;
    for (const part of line.split(/(\*\*\*|\*\*|\*)/)) {
      if (part === '***') { bold = !bold; italic = !italic; continue; }
      if (part === '**') { bold = !bold; continue; }
      if (part === '*') { italic = !italic; continue; }
      if (part) runs.push({ text: part, style: bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal' });
    }
    if (bullet) runs.unshift({ text: '•', style: 'normal', bullet: true });
    return { runs, bullet };
  });
}

function layoutRich(doc, paragraphs, width, size, font = 'helvetica') {
  doc.setFontSize(size);
  const measure = (text, style) => {
    doc.setFont(font, style);
    return doc.getTextWidth(text);
  };
  const lineH = size * PT * 1.18;
  const paraGap = lineH * 0.35;
  const spaceW = measure(' ', 'normal');
  const items = []; // { type: 'line', y, x, words } or gaps
  let y = 0;
  let first = true;

  for (const para of paragraphs) {
    if (!para.runs.length) {
      if (!first) y += paraGap;
      continue;
    }
    if (!first) y += paraGap;
    first = false;

    const words = [];
    let current = [];
    for (const run of para.runs) {
      for (const chunk of run.text.split(/(\s+)/)) {
        if (!chunk) continue;
        if (/^\s+$/.test(chunk)) {
          if (current.length) { words.push(current); current = []; }
        } else {
          current.push({ text: chunk, style: run.style, w: measure(chunk, run.style) });
        }
      }
      if (run.bullet && current.length) { words.push(current); current = []; }
    }
    if (current.length) words.push(current);

    const indent = para.bullet ? measure('• ', 'normal') : 0;
    let line = [];
    let lineW = 0;
    let lineIndent = 0;
    const flush = () => {
      items.push({ y, x: lineIndent, words: line });
      y += lineH;
      line = [];
      lineW = 0;
      lineIndent = indent;
    };
    for (const word of words) {
      const ww = word.reduce((a, p) => a + p.w, 0);
      const add = line.length ? spaceW + ww : ww;
      if (line.length && lineIndent + lineW + add > width) flush();
      lineW += line.length ? spaceW + ww : ww;
      line.push(word);
    }
    if (line.length) flush();
  }
  return { items, height: y, spaceW, size, font };
}

// Draws each line as runs of same-style text, so the viewer handles spacing inside a run.
function drawRich(doc, layout, x, y) {
  doc.setFontSize(layout.size);
  for (const item of layout.items) {
    const segments = [];
    let seg = null;
    item.words.forEach((word, wi) => {
      word.forEach((piece, pi) => {
        const sep = wi > 0 && pi === 0 ? ' ' : '';
        if (seg && seg.style === piece.style) {
          seg.text += sep + piece.text;
        } else {
          seg = { style: piece.style, text: piece.text, lead: seg ? sep : '' };
          segments.push(seg);
        }
      });
    });
    let cx = x + item.x;
    for (const s of segments) {
      doc.setFont(layout.font, s.style);
      if (s.lead) cx += layout.spaceW;
      doc.text(s.text, cx, y + item.y, { baseline: 'top' });
      cx += doc.getTextWidth(s.text);
    }
  }
}

function fitRich(doc, paragraphs, width, height, maxSize, minSize) {
  let layout;
  for (let size = maxSize; size >= minSize; size -= 0.25) {
    layout = layoutRich(doc, paragraphs, width, size);
    if (layout.height <= height) return { layout, overflow: false };
  }
  return { layout, overflow: true };
}

function fitLine(doc, text, font, style, maxW, maxSize, minSize) {
  doc.setFont(font, style);
  let size = maxSize;
  doc.setFontSize(size);
  while (size > minSize && doc.getTextWidth(text) > maxW) {
    size -= 0.25;
    doc.setFontSize(size);
  }
  let out = text;
  if (doc.getTextWidth(out) > maxW) {
    while (out.length > 1 && doc.getTextWidth(`${out}…`) > maxW) out = out.slice(0, -1);
    out = `${out.trimEnd()}…`;
  }
  return { text: out, size };
}

// ---------- Card ----------

function clipRect(doc, x, y, w, h, draw) {
  doc.saveGraphicsState();
  doc.rect(x, y, w, h, null);
  doc.clip();
  doc.discardPath();
  draw();
  doc.restoreGraphicsState();
}

// Lays out a stat value so it fits the cell; returns lines and font size.
function fitStat(doc, value, width) {
  doc.setFont('helvetica', 'normal');
  for (const [size, maxLines] of [[6.5, 2], [6, 2], [5.5, 2], [5, 3], [4.5, 3], [4, 4]]) {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(value || '—', width);
    if (lines.length <= maxLines) return { lines, size };
  }
  doc.setFontSize(4);
  return { lines: doc.splitTextToSize(value || '—', width).slice(0, 4), size: 4 };
}

function drawCard(doc, card, x, y, art, opts) {
  const text = opts.text;
  const tone = opts.grayscale ? toGray : (c) => c;
  const color = tone(card.colorRgb || opts.colors[card.schoolKey] || opts.colors.unknown);
  const tint = mix(color, 0.82);
  const pale = mix(color, 0.93);
  const paper = opts.inkSaver ? [255, 255, 255] : tone([251, 247, 238]);
  const INK = tone(INK_COLOR);

  // Frame
  if (opts.inkSaver) {
    doc.setDrawColor(170, 170, 170);
    doc.setLineWidth(0.15);
    doc.rect(x, y, CARD.w, CARD.h, 'S');
  } else {
    doc.setFillColor(...color);
    doc.rect(x, y, CARD.w, CARD.h, 'F');
  }
  const ix = x + FRAME;
  const iy = y + FRAME;
  const ih = CARD.h - 2 * FRAME;
  doc.setFillColor(...paper);
  doc.setDrawColor(...color);
  doc.setLineWidth(opts.inkSaver ? 0.6 : 0.2);
  doc.roundedRect(ix, iy, INNER_W, ih, 1.6, 1.6, opts.inkSaver ? 'FD' : 'F');

  const cx = ix + PAD;
  let cy = iy + PAD;

  // Title bar with level badge
  const titleH = 6.6;
  doc.setFillColor(...tint);
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.roundedRect(cx, cy, CONTENT_W, titleH, 1.2, 1.2, 'FD');
  const hasLevel = card.level !== null && card.level !== undefined;
  const r = 2.5;
  const bx = cx + CONTENT_W - r - 0.8;
  const by = cy + titleH / 2;
  if (hasLevel) {
    doc.setFillColor(...color);
    doc.circle(bx, by, r, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    doc.text(card.level === 0 ? text.cantrip_badge : String(card.level), bx, by + 0.15, { align: 'center', baseline: 'middle' });
  }

  const name = fitLine(doc, card.name, 'times', 'bold', CONTENT_W - (hasLevel ? 2 * r + 3.4 : 3.2), 10.5, 6.5);
  doc.setTextColor(...INK);
  doc.setFont('times', 'bold');
  doc.setFontSize(name.size);
  doc.text(name.text, cx + 1.6, by + 0.2, { baseline: 'middle' });
  cy += titleH + 1.1;

  // Artwork
  if (art) {
    doc.addImage(art.data, 'JPEG', cx, cy, CONTENT_W, ART_H, art.alias, 'FAST');
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.rect(cx, cy, CONTENT_W, ART_H, 'S');
    cy += ART_H + 1.1;
  }

  // Stats grid: only the filled stats, two per row; a lone last stat takes the full width.
  const gap = 0.9;
  const halfW = (CONTENT_W - gap) / 2;
  const labelH = 2.1;
  const stats = [
    [text.casting_time, card.casting_time],
    [text.range, card.range],
    [text.components, card.components],
    [text.duration, card.duration],
  ].filter(([, value]) => value);
  const rows = [];
  for (let i = 0; i < stats.length; i += 2) rows.push(stats.slice(i, i + 2));
  for (const row of rows) {
    const cellW = row.length === 1 ? CONTENT_W : halfW;
    const cells = row.map(([label, value]) => ({ label, ...fitStat(doc, value, cellW - 1.8) }));
    const rowH = Math.max(6.2, ...cells.map((c) => labelH + c.lines.length * c.size * PT * 1.15 + 1.3));
    cells.forEach((c, i) => {
      const sx = cx + i * (cellW + gap);
      doc.setFillColor(...pale);
      doc.roundedRect(sx, cy, cellW, rowH, 0.8, 0.8, 'F');
      doc.setTextColor(...color);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(4.6);
      doc.text(c.label.toUpperCase(), sx + 0.9, cy + 0.8, { baseline: 'top' });
      doc.setTextColor(...INK);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(c.size);
      doc.text(c.lines, sx + 0.9, cy + labelH + 0.6, { baseline: 'top', lineHeightFactor: 1.15 });
    });
    cy += rowH + gap;
  }

  // Footer: classes on the left, type line (level and school) on the right
  let bottom = iy + ih - PAD;
  const typeLine = text.typeLine(card.level, text.schoolName(card.schoolKey, card.school), card.ritual);
  if (card.classes || typeLine) {
    let typeW = 0;
    if (typeLine) {
      const maxW = card.classes ? CONTENT_W * 0.62 : CONTENT_W - 1;
      const tl = fitLine(doc, typeLine, 'times', 'italic', maxW, 6.5, 4.5);
      doc.setTextColor(...color);
      doc.setFont('times', 'italic');
      doc.setFontSize(tl.size);
      doc.text(tl.text, cx + CONTENT_W - 0.5, bottom, { baseline: 'bottom', align: 'right' });
      typeW = doc.getTextWidth(tl.text) + 2;
    }
    if (card.classes) {
      const cls = fitLine(doc, card.classes, 'helvetica', 'italic', CONTENT_W - 1 - typeW, 5, 4);
      doc.setTextColor(...mix(INK, 0.35));
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(cls.size);
      doc.text(cls.text, cx + 0.5, bottom, { baseline: 'bottom' });
    }
    bottom -= 2.9;
  }

  // Description box
  const boxY = cy + 0.2;
  const boxH = bottom - boxY;
  doc.setFillColor(...(opts.inkSaver ? [255, 255, 255] : tone([255, 253, 249])));
  doc.setDrawColor(...tint);
  doc.setLineWidth(0.3);
  doc.roundedRect(cx, boxY, CONTENT_W, boxH, 1, 1, 'FD');

  const paragraphs = parseRich(card.description);
  if (card.higher_levels) {
    const extra = parseRich(card.higher_levels);
    extra[0].runs.unshift({ text: `${text.higher_levels} `, style: 'bolditalic' });
    paragraphs.push(...extra);
  }
  const inset = 1.2;
  const fit = fitRich(doc, paragraphs, CONTENT_W - 2 * inset, boxH - 2 * inset, 7.5, 4.2);
  doc.setTextColor(...INK);
  clipRect(doc, cx, boxY, CONTENT_W, boxH, () => drawRich(doc, fit.layout, cx + inset, boxY + inset));
  return { overflow: fit.overflow };
}

function drawCropMarks(doc, mx, my, gap) {
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.15);
  const len = 5;
  const off = 1.5;
  const gridW = COLS * CARD.w + (COLS - 1) * gap;
  const gridH = ROWS * CARD.h + (ROWS - 1) * gap;
  const xs = new Set();
  const ys = new Set();
  for (let c = 0; c < COLS; c++) { xs.add(mx + c * (CARD.w + gap)); xs.add(mx + c * (CARD.w + gap) + CARD.w); }
  for (let r = 0; r < ROWS; r++) { ys.add(my + r * (CARD.h + gap)); ys.add(my + r * (CARD.h + gap) + CARD.h); }
  for (const x of xs) {
    doc.line(x, my - off - len, x, my - off);
    doc.line(x, my + gridH + off, x, my + gridH + off + len);
  }
  for (const y of ys) {
    doc.line(mx - off - len, y, mx - off, y);
    doc.line(mx + gridW + off, y, mx + gridW + off + len, y);
  }
}

// ---------- Public API ----------

export async function buildPdf(cards, opts, onProgress) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  doc.setProperties({ title: 'Spell cards', creator: 'Arcane Cards' });

  const list = cards.flatMap((c) => Array(c.copies).fill(c));
  const warnings = [];
  const images = await preloadImages(list, opts, warnings, onProgress);

  const gap = opts.gap ? 3 : 0;
  const mx = (PAGE.w - (COLS * CARD.w + (COLS - 1) * gap)) / 2;
  const my = (PAGE.h - (ROWS * CARD.h + (ROWS - 1) * gap)) / 2;
  const overflowed = new Set();

  list.forEach((card, i) => {
    const slot = i % PER_PAGE;
    if (i > 0 && slot === 0) doc.addPage();
    if (slot === 0 && opts.cropMarks) drawCropMarks(doc, mx, my, gap);
    const col = slot % COLS;
    const row = Math.floor(slot / COLS);
    const art = card.image ? images.get(`${card.image}|${card.imageFocus}`) : null;
    const res = drawCard(doc, card, mx + col * (CARD.w + gap), my + row * (CARD.h + gap), art, opts);
    if (res.overflow && !overflowed.has(card)) {
      overflowed.add(card);
      warnings.push({ code: 'w_overflow', name: card.name, detail: '' });
    }
  });

  return { doc, warnings, count: list.length, pages: Math.max(1, Math.ceil(list.length / PER_PAGE)) };
}
