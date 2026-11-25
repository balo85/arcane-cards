// Parsing and normalization of spell data from JSON or CSV.
import { findSchool, stripAccents } from './i18n.js';

const FIELD_ALIASES = {
  name: ['name', 'nome', 'spell', 'incantesimo'],
  level: ['level', 'livello', 'lvl'],
  school: ['school', 'scuola', 'school_of_magic', 'scuola_di_magia'],
  ritual: ['ritual', 'rituale'],
  casting_time: ['casting_time', 'castingtime', 'tempo_di_lancio', 'tempo_lancio'],
  range: ['range', 'gittata', 'portata'],
  components: ['components', 'componenti'],
  material: ['material', 'materiale', 'materiali'],
  duration: ['duration', 'durata'],
  description: ['description', 'descrizione', 'desc', 'text', 'testo'],
  higher_levels: ['higher_levels', 'at_higher_levels', 'ai_livelli_superiori', 'livelli_superiori'],
  image: ['image', 'immagine', 'image_url', 'url_immagine', 'img', 'art'],
  image_position: ['image_position', 'posizione_immagine', 'image_focus'],
  classes: ['classes', 'classi', 'class', 'classe'],
  color: ['color', 'colour', 'colore'],
  copies: ['copies', 'copie', 'quantity', 'quantita', 'qty'],
};

const ALIAS_TO_FIELD = new Map();
for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
  for (const a of aliases) ALIAS_TO_FIELD.set(a, field);
}

function normKey(k) {
  return stripAccents(String(k)).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Resolves a raw property or column name to { field, lang }.
function resolveKey(rawKey) {
  const candidates = [rawKey, ...String(rawKey).split('/')];
  for (const c of candidates) {
    const k = normKey(c);
    if (!k) continue;
    if (ALIAS_TO_FIELD.has(k)) return { field: ALIAS_TO_FIELD.get(k), lang: null };
    const m = k.match(/^(.*)_(en|it)$/);
    if (m && ALIAS_TO_FIELD.has(m[1])) return { field: ALIAS_TO_FIELD.get(m[1]), lang: m[2] };
  }
  return null;
}

// Returns { rows, labels } where labels is the optional "labels" object of a JSON file.
export function parseInput(text) {
  const clean = text.replace(/^﻿/, '').trim();
  if (clean.startsWith('[') || clean.startsWith('{')) {
    const data = JSON.parse(clean);
    const list = Array.isArray(data) ? data : (data.spells || data.incantesimi || data.cards);
    if (!Array.isArray(list)) throw new Error('JSON must be an array of spells or { "spells": [...] }');
    return { rows: list, settings: Array.isArray(data) ? null : data };
  }
  const res = window.Papa.parse(clean, { header: true, skipEmptyLines: 'greedy' });
  const fatal = res.errors.find((e) => e.type !== 'Delimiter');
  if (fatal && !res.data.length) throw new Error(`${fatal.message} (row ${fatal.row + 1})`);
  return { rows: res.data, settings: null };
}

function toText(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(toText).filter(Boolean).join(', ');
  return String(v).trim();
}

function parseBool(v) {
  if (typeof v === 'boolean') return v;
  const s = stripAccents(toText(v)).toLowerCase();
  return ['true', 'yes', 'y', 'si', '1', 'x', 'vero', 'ritual', 'rituale'].includes(s);
}

function parseLevel(v) {
  if (typeof v === 'number') return v;
  const s = stripAccents(toText(v)).toLowerCase();
  if (!s) return NaN;
  if (['cantrip', 'trucchetto', 'c', 't'].includes(s)) return 0;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? NaN : n;
}

// Turns raw rows into spells: { base: {field: value}, en: {...}, it: {...} }.
export function normalizeSpells(rows) {
  const spells = [];
  const warnings = [];
  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object') return;
    const spell = { base: {}, en: {}, it: {} };
    for (const [rawKey, value] of Object.entries(row)) {
      const r = resolveKey(rawKey);
      if (!r) continue;
      const target = r.lang ? spell[r.lang] : spell.base;
      target[r.field] = value;
    }
    const hasName = ['base', 'en', 'it'].some((k) => toText(spell[k].name));
    const hasContent = Object.values(row).some((v) => toText(v));
    if (!hasName) {
      if (hasContent) warnings.push({ code: 'w_noname', name: '', detail: index + 2 });
      return;
    }
    spells.push(spell);
  });
  return { spells, warnings };
}

function pick(spell, field, lang) {
  const other = lang === 'it' ? 'en' : 'it';
  for (const src of [spell[lang], spell.base, spell[other]]) {
    if (src && src[field] !== undefined && toText(src[field]) !== '') return src[field];
  }
  return undefined;
}

// Flattens a normalized spell into the printable fields for one language.
export function localize(spell, lang) {
  const warnings = [];
  const name = toText(pick(spell, 'name', lang));

  const rawLevel = pick(spell, 'level', lang);
  let level = parseLevel(rawLevel);
  if (Number.isNaN(level) || level < 0 || level > 9) {
    if (rawLevel !== undefined) warnings.push({ code: 'w_level', name, detail: toText(rawLevel) });
    level = Number.isNaN(level) ? 0 : Math.min(9, Math.max(0, level));
  }

  const rawSchool = toText(pick(spell, 'school', lang));
  const schoolKey = findSchool(rawSchool);
  if (rawSchool && !schoolKey) warnings.push({ code: 'w_school', name, detail: rawSchool });

  let components = toText(pick(spell, 'components', lang));
  const material = toText(pick(spell, 'material', lang));
  if (material && !components.includes('(')) components = `${components} (${material})`.trim();

  const copies = parseInt(toText(pick(spell, 'copies', lang)), 10);
  const pos = stripAccents(toText(pick(spell, 'image_position', lang))).toLowerCase();
  const focus = { top: 0, alto: 0, bottom: 1, basso: 1 }[pos] ?? 0.5;

  return {
    card: {
      name,
      level,
      schoolKey,
      school: rawSchool,
      ritual: parseBool(pick(spell, 'ritual', lang)),
      casting_time: toText(pick(spell, 'casting_time', lang)),
      range: toText(pick(spell, 'range', lang)),
      components,
      duration: toText(pick(spell, 'duration', lang)),
      description: toText(pick(spell, 'description', lang)),
      higher_levels: toText(pick(spell, 'higher_levels', lang)),
      image: toText(pick(spell, 'image', lang)),
      imageFocus: focus,
      classes: toText(pick(spell, 'classes', lang)),
      color: toText(pick(spell, 'color', lang)),
      copies: Number.isNaN(copies) ? 1 : Math.max(0, Math.min(copies, 99)),
    },
    warnings,
  };
}
