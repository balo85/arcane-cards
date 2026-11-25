import { t, FIELDS, cardText } from './i18n.js';
import { parseSettings, settingsFromObject, mergeSettings, labelOverrides, resolveColors, parseColor, defaultSettingsText } from './labels.js';
import { parseInput, normalizeSpells, localize } from './data.js';
import { buildPdf } from './render.js';

const $ = (sel) => document.querySelector(sel);
const els = {
  file: $('#file'),
  data: $('#data'),
  loadExample: $('#load-example'),
  clear: $('#clear'),
  deckWrap: $('#deck-wrap'),
  deck: $('#deck'),
  images: $('#images'),
  imagesInfo: $('#images-info'),
  clearImages: $('#clear-images'),
  it: $('#opt-it'),
  cropMarks: $('#opt-crop'),
  gap: $('#opt-gap'),
  inkSaver: $('#opt-ink'),
  proxy: $('#opt-proxy'),
  grayscale: $('#opt-bw'),
  labels: $('#labels'),
  custom: $('#opt-custom'),
  customBody: $('#custom-body'),
  resetLabels: $('#reset-labels'),
  generate: $('#generate'),
  download: $('#download'),
  status: $('#status'),
  warnings: $('#warnings'),
  preview: $('#preview'),
  previewEmpty: $('#preview-empty'),
  fields: $('#fields-body'),
};

const OPTION_IDS = ['it', 'grayscale', 'cropMarks', 'gap', 'inkSaver', 'proxy', 'custom'];
const STORAGE_KEY = 'arcane-cards';
const localImages = new Map();
let pdfUrl = null;
let generated = false;
let lastStatus = null;
let lastWarnings = [];

const lang = () => (els.it.checked ? 'it' : 'en');

// ---------- Persistence (per-browser convenience only) ----------

function save() {
  try {
    const state = { data: els.data.value, labels: els.labels.value };
    for (const id of OPTION_IDS) state[id] = els[id].checked;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* storage unavailable */ }
}

function restore() {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!state) return false;
    for (const id of OPTION_IDS) if (typeof state[id] === 'boolean') els[id].checked = state[id];
    if (state.data) els.data.value = state.data;
    if (state.labels) els.labels.value = state.labels;
    return true;
  } catch {
    return false;
  }
}

// ---------- UI language ----------

function applyUi() {
  const l = lang();
  document.documentElement.lang = l;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(l, el.dataset.i18n); });
  els.data.placeholder = l === 'it' ? 'nome,livello,scuola,…' : 'name,level,school,…';
  els.fields.innerHTML = '';
  for (const f of FIELDS) {
    const tr = document.createElement('tr');
    const desc = l === 'it' ? f.it_desc : f.en_desc;
    tr.innerHTML = `<td><code>${f.key}</code>${f.required ? ` <span class="req">${t(l, 'required')}</span>` : ''}</td><td><code>${f.it}</code></td><td></td>`;
    tr.lastElementChild.textContent = desc;
    els.fields.appendChild(tr);
  }
  showImagesInfo();
  if (lastStatus) setStatus(lastStatus.key, lastStatus.params, lastStatus.kind);
  renderWarnings(lastWarnings);
}

function setStatus(key, params = {}, kind = '') {
  lastStatus = { key, params, kind };
  els.status.textContent = key ? t(lang(), key, params) : '';
  els.status.className = `status ${kind}`;
}

function renderWarnings(list) {
  lastWarnings = list;
  els.warnings.innerHTML = '';
  if (!list.length) { els.warnings.hidden = true; return; }
  els.warnings.hidden = false;
  const title = document.createElement('strong');
  title.textContent = t(lang(), 'warnings');
  const ul = document.createElement('ul');
  for (const w of list) {
    const li = document.createElement('li');
    li.textContent = t(lang(), w.code, { name: w.name, detail: w.detail });
    ul.appendChild(li);
  }
  els.warnings.append(title, ul);
}

// ---------- Generation ----------

async function generate() {
  const text = els.data.value.trim();
  if (!text) { setStatus('noData', {}, 'error'); return; }
  let parsed;
  try {
    parsed = parseInput(text);
  } catch (err) {
    setStatus('parseError', { msg: err.message }, 'error');
    return;
  }
  const { spells, warnings } = normalizeSpells(parsed.rows);

  let custom = null;
  if (els.custom.checked) {
    try {
      const res = parseSettings(els.labels.value);
      custom = res.settings;
      warnings.push(...res.warnings);
    } catch (err) {
      setStatus('labelsError', { msg: err.message }, 'error');
      return;
    }
  }
  const settings = mergeSettings(settingsFromObject(parsed.settings, warnings), custom);
  if (!spells.length) { setStatus('noSpells', {}, 'error'); renderWarnings(warnings); return; }

  const l = lang();
  const cards = spells.map((s) => {
    const res = localize(s, l);
    warnings.push(...res.warnings);
    if (res.card.color) {
      res.card.colorRgb = parseColor(res.card.color);
      if (!res.card.colorRgb) warnings.push({ code: 'w_color', name: res.card.name, detail: res.card.color });
    }
    return res.card;
  });

  els.generate.disabled = true;
  try {
    const opts = {
      lang: l,
      cropMarks: els.cropMarks.checked,
      gap: els.gap.checked,
      inkSaver: els.inkSaver.checked,
      proxy: els.proxy.checked,
      grayscale: els.grayscale.checked,
      text: cardText(l, labelOverrides(settings, l)),
      colors: resolveColors(settings),
      localImages,
    };
    const res = await buildPdf(cards, opts, (done, total) => {
      if (total) setStatus('working', { done, total });
    });
    setStatus('rendering');
    const blob = res.doc.output('blob');
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    pdfUrl = URL.createObjectURL(blob);
    els.preview.src = pdfUrl;
    els.preview.hidden = false;
    els.previewEmpty.hidden = true;
    els.download.href = pdfUrl;
    els.download.download = `spell-cards-${l}.pdf`;
    els.download.hidden = false;
    generated = true;
    setStatus('done', { cards: res.count, pages: res.pages }, 'ok');
    renderWarnings([...warnings, ...res.warnings]);
  } catch (err) {
    console.error(err);
    setStatus('failed', { msg: err.message || String(err) }, 'error');
  } finally {
    els.generate.disabled = false;
  }
}

// ---------- Data sources ----------

async function loadUrl(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  els.data.value = await res.text();
  save();
  await generate();
}

async function loadDeckList() {
  try {
    const res = await fetch('decks/index.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const files = await res.json();
    if (!Array.isArray(files) || !files.length) return;
    for (const f of files) {
      const opt = document.createElement('option');
      opt.value = `decks/${f}`;
      opt.textContent = f.replace(/\.(json|csv)$/i, '').replace(/[-_]+/g, ' ');
      els.deck.appendChild(opt);
    }
    els.deckWrap.hidden = false;
  } catch { /* no deck index */ }
}

// ---------- Events ----------

els.file.addEventListener('change', async () => {
  const f = els.file.files[0];
  if (!f) return;
  els.data.value = await f.text();
  els.file.value = '';
  save();
  generate();
});

// Local images and zip archives are read in the browser and kept in memory only.
const IMAGE_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif', bmp: 'image/bmp',
};

async function addZip(file) {
  const zip = await window.JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((e) => {
    const name = e.name.split('/').pop();
    return !e.dir && !e.name.startsWith('__MACOSX/') && !name.startsWith('.');
  });
  for (const entry of entries) {
    const name = entry.name.split('/').pop().toLowerCase();
    const type = IMAGE_TYPES[name.split('.').pop()];
    if (!type) continue;
    const data = await entry.async('arraybuffer');
    localImages.set(name, new Blob([data], { type }));
  }
}

function showImagesInfo() {
  els.imagesInfo.textContent = localImages.size ? t(lang(), 'localLoaded', { n: localImages.size }) : '';
  els.clearImages.hidden = !localImages.size;
}

els.images.addEventListener('change', async () => {
  const files = [...els.images.files];
  els.images.value = '';
  for (const f of files) {
    const isZip = /\.zip$/i.test(f.name) || f.type.includes('zip');
    try {
      if (isZip) await addZip(f);
      else localImages.set(f.name.toLowerCase(), f);
    } catch (err) {
      setStatus('zipError', { name: f.name, msg: err.message || String(err) }, 'error');
    }
  }
  showImagesInfo();
  if (generated) generate();
});

els.clearImages.addEventListener('click', () => {
  localImages.clear();
  showImagesInfo();
  if (generated) generate();
});

els.loadExample.addEventListener('click', () => {
  loadUrl('decks/sample-spells.json').catch((err) => setStatus('deckError', { msg: err.message }, 'error'));
});

els.deck.addEventListener('change', () => {
  if (!els.deck.value) return;
  loadUrl(els.deck.value).catch((err) => setStatus('deckError', { msg: err.message }, 'error'));
});

els.clear.addEventListener('click', () => {
  els.data.value = '';
  save();
});

els.data.addEventListener('input', save);
els.labels.addEventListener('input', save);
els.resetLabels.addEventListener('click', () => {
  els.labels.value = defaultSettingsText();
  save();
  if (generated) generate();
});
els.custom.addEventListener('change', () => { els.customBody.hidden = !els.custom.checked; });
els.generate.addEventListener('click', generate);

for (const id of OPTION_IDS) {
  els[id].addEventListener('change', () => {
    save();
    if (id === 'it') applyUi();
    if (generated) generate();
  });
}

// Drag and drop a file anywhere on the data area.
const drop = $('#drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
drop.addEventListener('drop', async (e) => {
  const f = e.dataTransfer.files[0];
  if (!f) return;
  els.data.value = await f.text();
  save();
  generate();
});

// ---------- Init ----------

if (!restore() && navigator.language && navigator.language.toLowerCase().startsWith('it')) {
  els.it.checked = true;
}
if (!els.labels.value.trim()) els.labels.value = defaultSettingsText();
els.customBody.hidden = !els.custom.checked;
applyUi();
loadDeckList();
