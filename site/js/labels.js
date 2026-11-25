// Optional overrides for card labels and colours, edited as JSON on the page.
import { SCHOOLS, DEFAULT_LABELS, DEFAULT_COLORS, findSchool, stripAccents } from './i18n.js';

const LABEL_ALIASES = {
  casting_time: ['casting_time', 'tempo_di_lancio', 'tempo_lancio'],
  range: ['range', 'gittata'],
  components: ['components', 'componenti'],
  duration: ['duration', 'durata'],
  higher_levels: ['higher_levels', 'at_higher_levels', 'ai_livelli_superiori', 'livelli_superiori'],
  ritual: ['ritual', 'rituale'],
  cantrip_badge: ['cantrip_badge', 'badge_trucchetto'],
  level_line: ['level_line', 'riga_livello'],
  cantrip_line: ['cantrip_line', 'riga_trucchetto'],
  no_school: ['no_school', 'senza_scuola'],
};
const UNKNOWN_KEYS = ['unknown', 'sconosciuta', 'default', 'predefinito', 'other', 'altro'];

const ALIAS_TO_LABEL = new Map();
for (const [key, aliases] of Object.entries(LABEL_ALIASES)) {
  for (const a of aliases) ALIAS_TO_LABEL.set(a, key);
}

const normKey = (k) => stripAccents(String(k)).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

function resolveLabel(raw) {
  const k = normKey(raw);
  if (ALIAS_TO_LABEL.has(k)) return ALIAS_TO_LABEL.get(k);
  return findSchool(k.replace(/_/g, ' '));
}

// ---------- Colours ----------

let colorCtx;

// Parses any CSS colour (name, #hex, rgb(), hsl()) into [r, g, b], or null when invalid.
export function parseColor(value) {
  if (Array.isArray(value) && value.length >= 3) return value.slice(0, 3).map(Number);
  const s = String(value ?? '').trim();
  if (!s) return null;
  colorCtx ||= document.createElement('canvas').getContext('2d');
  // An invalid colour leaves fillStyle unchanged, whatever value it had before.
  colorCtx.fillStyle = '#000000';
  colorCtx.fillStyle = s;
  const out = colorCtx.fillStyle;
  colorCtx.fillStyle = '#ffffff';
  colorCtx.fillStyle = s;
  if (out === '#000000' && colorCtx.fillStyle === '#ffffff') return null;
  if (out.startsWith('#')) return [1, 3, 5].map((i) => parseInt(out.slice(i, i + 2), 16));
  const m = out.match(/[\d.]+/g);
  return m ? m.slice(0, 3).map((n) => Math.round(Number(n))) : null;
}

// ---------- Settings ----------

function emptySettings() {
  return { labels: { all: {}, en: {}, it: {} }, colors: {} };
}

function assignLabel(out, rawKey, value, lang, warnings) {
  if (value === null || value === undefined) return;
  const key = resolveLabel(rawKey);
  if (!key) {
    warnings.push({ code: 'w_label', name: '', detail: rawKey });
    return;
  }
  out.labels[lang || 'all'][key] = String(value).trim();
}

function assignColor(out, rawKey, value, warnings) {
  const k = normKey(rawKey);
  const key = UNKNOWN_KEYS.includes(k) ? 'unknown' : findSchool(k.replace(/_/g, ' '));
  if (!key) {
    warnings.push({ code: 'w_label', name: '', detail: rawKey });
    return;
  }
  const rgb = parseColor(value);
  if (!rgb) {
    warnings.push({ code: 'w_color', name: rawKey, detail: value });
    return;
  }
  out.colors[key] = rgb;
}

// Reads { labels: { en: {...}, it: {...} } or flat, colors: { school: "name" } }.
export function settingsFromObject(obj, warnings = []) {
  const out = emptySettings();
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  const labels = obj.labels || obj.etichette;
  if (labels && typeof labels === 'object') {
    for (const [k, v] of Object.entries(labels)) {
      const lk = normKey(k);
      if ((lk === 'en' || lk === 'it') && v && typeof v === 'object') {
        for (const [k2, v2] of Object.entries(v)) assignLabel(out, k2, v2, lk, warnings);
      } else {
        assignLabel(out, k, v, null, warnings);
      }
    }
  }
  const colors = obj.colors || obj.colori;
  if (colors && typeof colors === 'object') {
    for (const [k, v] of Object.entries(colors)) assignColor(out, k, v, warnings);
  }
  return out;
}

export function parseSettings(text) {
  const warnings = [];
  const clean = (text || '').replace(/^﻿/, '').trim();
  if (!clean) return { settings: emptySettings(), warnings };
  return { settings: settingsFromObject(JSON.parse(clean), warnings), warnings };
}

export function mergeSettings(...sets) {
  const out = emptySettings();
  for (const s of sets) {
    if (!s) continue;
    for (const k of ['all', 'en', 'it']) Object.assign(out.labels[k], s.labels[k]);
    Object.assign(out.colors, s.colors);
  }
  return out;
}

export function labelOverrides(settings, lang) {
  return { ...settings.labels.all, ...settings.labels[lang] };
}

// Colour per school key (plus "unknown") as [r, g, b].
export function resolveColors(settings) {
  const out = {};
  for (const [key, name] of Object.entries(DEFAULT_COLORS)) out[key] = parseColor(name);
  return Object.assign(out, settings.colors);
}

// Default settings shown in the editor.
export function defaultSettingsText() {
  const labels = {};
  for (const lang of ['en', 'it']) {
    labels[lang] = {};
    for (const [k, v] of Object.entries(DEFAULT_LABELS[lang])) {
      if (!(k in SCHOOLS)) labels[lang][k] = v;
    }
    for (const k of Object.keys(SCHOOLS)) labels[lang][k] = DEFAULT_LABELS[lang][k];
  }
  return `${JSON.stringify({ labels, colors: DEFAULT_COLORS }, null, 2)}\n`;
}
