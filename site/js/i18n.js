// Localized strings, school metadata and level formatting for cards and UI.

export const SCHOOLS = {
  abjuration: { en: 'Abjuration', it: 'Abiurazione', aliases: ['abjuration', 'abiurazione'] },
  conjuration: { en: 'Conjuration', it: 'Evocazione', aliases: ['conjuration', 'evocazione'] },
  divination: { en: 'Divination', it: 'Divinazione', aliases: ['divination', 'divinazione'] },
  enchantment: { en: 'Enchantment', it: 'Ammaliamento', aliases: ['enchantment', 'ammaliamento', 'incantamento'] },
  evocation: { en: 'Evocation', it: 'Invocazione', aliases: ['evocation', 'invocazione'] },
  illusion: { en: 'Illusion', it: 'Illusione', aliases: ['illusion', 'illusione'] },
  necromancy: { en: 'Necromancy', it: 'Necromanzia', aliases: ['necromancy', 'necromanzia', 'negromanzia'] },
  transmutation: { en: 'Transmutation', it: 'Trasmutazione', aliases: ['transmutation', 'trasmutazione'] },
};

// Default card colours by school, as CSS colour names. "unknown" is used when the school is missing.
export const DEFAULT_COLORS = {
  abjuration: 'royalblue',
  conjuration: 'chocolate',
  divination: 'teal',
  enchantment: 'mediumvioletred',
  evocation: 'firebrick',
  illusion: 'rebeccapurple',
  necromancy: 'darkolivegreen',
  transmutation: 'darkgoldenrod',
  unknown: 'dimgray',
};

export function findSchool(value) {
  const v = stripAccents(String(value || '')).toLowerCase().trim();
  if (!v) return null;
  for (const [key, s] of Object.entries(SCHOOLS)) {
    if (s.aliases.includes(v)) return key;
  }
  return null;
}

export function stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function ordinal(n, lang) {
  if (lang === 'it') return `${n}°`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n] || 'th';
  return `${n}${suffix}`;
}

// Default labels printed on the cards. Every key can be overridden by a labels file.
// level_line and cantrip_line accept {level}, {ordinal}, {school} and {school_lower}.
export const DEFAULT_LABELS = {
  en: {
    casting_time: 'Casting Time',
    range: 'Range',
    components: 'Components',
    duration: 'Duration',
    higher_levels: 'At Higher Levels.',
    ritual: '(ritual)',
    cantrip_badge: 'C',
    level_line: '{ordinal}-level {school_lower}',
    cantrip_line: '{school} cantrip',
    no_school: 'Spell',
  },
  it: {
    casting_time: 'Tempo di lancio',
    range: 'Gittata',
    components: 'Componenti',
    duration: 'Durata',
    higher_levels: 'Ai livelli superiori.',
    ritual: '(rituale)',
    cantrip_badge: 'T',
    level_line: '{school} di {ordinal} livello',
    cantrip_line: 'Trucchetto di {school_lower}',
    no_school: 'Incantesimo',
  },
};
for (const [key, s] of Object.entries(SCHOOLS)) {
  DEFAULT_LABELS.en[key] = s.en;
  DEFAULT_LABELS.it[key] = s.it;
}

const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

// Builds the card text for one language, applying optional overrides ({ key: text }).
export function cardText(lang, overrides = {}) {
  const L = { ...DEFAULT_LABELS[lang], ...overrides };
  return {
    ...L,
    schoolName(schoolKey, raw) {
      return schoolKey ? L[schoolKey] : raw;
    },
    // Without a level only the school (or free text such as "Armor") is printed.
    typeLine(level, school, ritual) {
      if (level === null || level === undefined) {
        const t = school || '';
        return ritual && L.ritual && t ? `${t} ${L.ritual}` : t;
      }
      const s = school || L.no_school;
      const vars = { level, ordinal: ordinal(level, lang), school: s, school_lower: s.toLowerCase() };
      const base = fill(level === 0 ? L.cantrip_line : L.level_line, vars);
      return ritual && L.ritual ? `${base} ${L.ritual}` : base;
    },
  };
}

// Field reference shown on the site and used to document templates.
export const FIELDS = [
  { key: 'name', it: 'nome', required: true, en_desc: 'Spell name.', it_desc: "Nome dell'incantesimo." },
  { key: 'level', it: 'livello', en_desc: '0 (cantrip) to 9. Leave empty for non-spell cards (armour, weapons): only the school text is printed.', it_desc: 'Da 0 (trucchetto) a 9. Lascia vuoto per carte che non sono incantesimi (armature, armi): viene stampato solo il testo della scuola.' },
  { key: 'school', it: 'scuola', required: true, en_desc: 'School of magic (English or Italian name), or any text such as "Armor" for non-spell cards.', it_desc: 'Scuola di magia (nome inglese o italiano), o un testo qualsiasi come "Armatura" per carte che non sono incantesimi.' },
  { key: 'ritual', it: 'rituale', en_desc: 'true / false (also yes, sì, 1, x).', it_desc: 'true / false (anche sì, si, 1, x).' },
  { key: 'casting_time', it: 'tempo_di_lancio', en_desc: 'e.g. "1 action".', it_desc: 'es. "1 azione".' },
  { key: 'range', it: 'gittata', en_desc: 'e.g. "150 feet".', it_desc: 'es. "45 metri".' },
  { key: 'components', it: 'componenti', en_desc: 'e.g. "V, S, M (a pinch of sulfur)".', it_desc: 'es. "V, S, M (un pizzico di zolfo)".' },
  { key: 'duration', it: 'durata', en_desc: 'e.g. "Instantaneous".', it_desc: 'es. "Istantanea".' },
  { key: 'description', it: 'descrizione', required: true, en_desc: 'Spell text. Supports **bold**, *italic*, new lines and "- " bullets.', it_desc: 'Testo. Supporta **grassetto**, *corsivo*, a capo e punti elenco "- ".' },
  { key: 'higher_levels', it: 'ai_livelli_superiori', en_desc: 'Optional "At Higher Levels" text.', it_desc: 'Testo opzionale "Ai livelli superiori".' },
  { key: 'image', it: 'immagine', en_desc: 'Image URL (https://…), a path in this repository (images/x.svg) or a local file name.', it_desc: 'URL immagine (https://…), un percorso nel repository (images/x.svg) o il nome di un file locale.' },
  { key: 'image_position', it: 'posizione_immagine', en_desc: 'top / center / bottom: which part of the image to keep.', it_desc: "top / center / bottom: quale parte dell'immagine mantenere." },
  { key: 'color', it: 'colore', en_desc: 'Optional card colour: a CSS name (crimson, navy…) or #hex. Overrides the school colour.', it_desc: 'Colore opzionale della carta: nome CSS (crimson, navy…) o #hex. Sostituisce il colore della scuola.' },
  { key: 'classes', it: 'classi', en_desc: 'Optional, printed in the footer.', it_desc: 'Opzionale, stampato in fondo alla carta.' },
  { key: 'copies', it: 'copie', en_desc: 'Number of copies of this card (default 1).', it_desc: 'Numero di copie della carta (predefinito 1).' },
];

// User interface strings.
export const UI = {
  en: {
    subtitle: 'Printable D&D 5e spell cards with your own artwork. Standard 63 × 88 mm cards, 9 per A4 page.',
    step1: '1. Spell data',
    upload: 'Upload JSON or CSV',
    pasteLabel: 'Or paste and edit here (JSON or CSV)',
    loadExample: 'Load example',
    clear: 'Clear',
    templates: 'Download a template',
    repoDecks: 'Decks in this repository',
    chooseDeck: '— choose a deck —',
    step2: '2. Artwork (optional)',
    imagesHelp: 'Put an image URL in the "image" field. Images in this repository work with a relative path (images/fireball.svg). You can also pick image files or a .zip of images from your computer and reference them by file name (fireball.jpg).',
    imageSize: 'Image size: {bestW} × {bestH} px or larger is ideal (landscape, about {ratio}:1). Minimum {minW} × {minH} px for a sharp print at 300 dpi. The art area is {mmW} × {mmH} mm: other shapes are cropped to fill it, and "image_position" picks which part to keep.',
    imagesPrivacy: 'Local images and zip files never leave your computer: they are read by your browser, kept in memory only and discarded when you clear them, reload or close the page.',
    clearImages: 'Clear images',
    zipError: 'Could not read "{name}": {msg}',
    localImages: 'Local images or .zip',
    localLoaded: '{n} local image(s) loaded',
    step3: '3. Options',
    italian: 'Cards in Italian / Carte in italiano',
    blackWhite: 'Black & white (no colour)',
    step4: '4. Custom labels and colours (optional)',
    useCustom: 'Use custom labels and colours',
    labelsHelp: 'Edit the JSON below. "labels" renames the text printed on the cards (for example "casting_time": "Tempistiche"). "colors" sets the colour of each school: any CSS colour name (crimson, navy, seagreen…) or a #hex code. Remove a line to keep its default.',
    resetDefaults: 'Reset to defaults',
    labelsError: 'Could not read the custom labels and colours: {msg}',
    w_label: 'Unknown key "{detail}", ignored.',
    w_color: '"{name}": "{detail}" is not a valid colour.',
    cropMarks: 'Crop marks',
    gap: 'Space between cards (3 mm)',
    inkSaver: 'Ink saver (white frame)',
    proxy: 'Retry blocked images through images.weserv.nl',
    generate: 'Generate PDF',
    download: 'Download PDF',
    preview: 'Preview',
    previewEmpty: 'Generate the PDF to see the preview here.',
    fieldsRef: 'Field reference',
    fieldsIntro: 'Column or property names. English and Italian names are both accepted. Add _en or _it to any field (name_it, description_en…) to keep both languages in one file: the checkbox picks which one is printed. A file in one language works too: the checkbox then only changes the labels and the school names.',
    colField: 'Field',
    colItalian: 'Italian name',
    colDesc: 'Description',
    required: 'required',
    noData: 'Add some spell data first.',
    parseError: 'Could not read the data: {msg}',
    noSpells: 'No spells found. Check the field names.',
    working: 'Loading images {done}/{total}…',
    rendering: 'Drawing cards…',
    done: '{cards} card(s) on {pages} page(s).',
    failed: 'PDF generation failed: {msg}',
    warnings: 'Warnings',
    w_school: '"{name}": unknown school "{detail}".',
    w_level: '"{name}": level "{detail}" is not a number from 0 to 9.',
    w_image: '"{name}": image not loaded ({detail}).',
    w_overflow: '"{name}": text too long, it was cut. Shorten the description.',
    w_noname: 'Row {detail}: no name, skipped.',
    deckError: 'Could not load the deck: {msg}',
    footer: 'Runs entirely in your browser: your data is never uploaded.',
  },
  it: {
    subtitle: 'Carte incantesimo stampabili per D&D 5e con le tue illustrazioni. Formato standard 63 × 88 mm, 9 per pagina A4.',
    step1: '1. Dati degli incantesimi',
    upload: 'Carica JSON o CSV',
    pasteLabel: 'Oppure incolla e modifica qui (JSON o CSV)',
    loadExample: 'Carica esempio',
    clear: 'Svuota',
    templates: 'Scarica un modello',
    repoDecks: 'Mazzi in questo repository',
    chooseDeck: '— scegli un mazzo —',
    step2: '2. Illustrazioni (opzionali)',
    imagesHelp: 'Inserisci l\'URL di un\'immagine nel campo "immagine". Le immagini nel repository funzionano con un percorso relativo (images/fireball.svg). Puoi anche scegliere immagini o un file .zip di immagini dal tuo computer e indicarle per nome (fireball.jpg).',
    imageSize: 'Dimensione immagini: ideale {bestW} × {bestH} px o più (orizzontale, circa {ratio}:1). Minimo {minW} × {minH} px per una stampa nitida a 300 dpi. L\'area illustrazione è {mmW} × {mmH} mm: le immagini con altre proporzioni vengono ritagliate per riempirla e "posizione_immagine" sceglie quale parte tenere.',
    imagesPrivacy: 'Le immagini locali e i file zip non lasciano mai il tuo computer: li legge il browser, restano solo in memoria e vengono eliminati quando li svuoti, ricarichi o chiudi la pagina.',
    clearImages: 'Svuota immagini',
    zipError: 'Impossibile leggere "{name}": {msg}',
    localImages: 'Immagini locali o .zip',
    localLoaded: '{n} immagine/i locale/i caricata/e',
    step3: '3. Opzioni',
    italian: 'Carte in italiano / Cards in Italian',
    blackWhite: 'Bianco e nero (senza colore)',
    step4: '4. Etichette e colori personalizzati (opzionali)',
    useCustom: 'Usa etichette e colori personalizzati',
    labelsHelp: 'Modifica il JSON qui sotto. "labels" rinomina i testi stampati sulle carte (ad esempio "casting_time": "Tempistiche"). "colors" imposta il colore di ogni scuola: qualsiasi nome di colore CSS (crimson, navy, seagreen…) o un codice #hex. Elimina una riga per tenere il valore predefinito.',
    resetDefaults: 'Ripristina predefiniti',
    labelsError: 'Impossibile leggere etichette e colori personalizzati: {msg}',
    w_label: 'Chiave sconosciuta "{detail}", ignorata.',
    w_color: '"{name}": "{detail}" non è un colore valido.',
    cropMarks: 'Segni di taglio',
    gap: 'Spazio tra le carte (3 mm)',
    inkSaver: 'Risparmio inchiostro (cornice bianca)',
    proxy: 'Riprova le immagini bloccate tramite images.weserv.nl',
    generate: 'Genera PDF',
    download: 'Scarica PDF',
    preview: 'Anteprima',
    previewEmpty: "Genera il PDF per vedere qui l'anteprima.",
    fieldsRef: 'Riferimento campi',
    fieldsIntro: 'Nomi delle colonne o proprietà. Sono accettati sia i nomi inglesi che italiani. Aggiungi _en o _it a qualsiasi campo (name_it, description_en…) per tenere entrambe le lingue nello stesso file: la casella sceglie quale stampare. Va bene anche un file in una sola lingua: la casella cambia allora solo le etichette e i nomi delle scuole.',
    colField: 'Campo',
    colItalian: 'Nome italiano',
    colDesc: 'Descrizione',
    required: 'obbligatorio',
    noData: 'Aggiungi prima i dati degli incantesimi.',
    parseError: 'Impossibile leggere i dati: {msg}',
    noSpells: 'Nessun incantesimo trovato. Controlla i nomi dei campi.',
    working: 'Caricamento immagini {done}/{total}…',
    rendering: 'Disegno delle carte…',
    done: '{cards} carta/e su {pages} pagina/e.',
    failed: 'Generazione del PDF fallita: {msg}',
    warnings: 'Avvisi',
    w_school: '"{name}": scuola sconosciuta "{detail}".',
    w_level: '"{name}": il livello "{detail}" non è un numero da 0 a 9.',
    w_image: '"{name}": immagine non caricata ({detail}).',
    w_overflow: '"{name}": testo troppo lungo, è stato tagliato. Accorcia la descrizione.',
    w_noname: 'Riga {detail}: senza nome, ignorata.',
    deckError: 'Impossibile caricare il mazzo: {msg}',
    footer: 'Funziona interamente nel browser: i tuoi dati non vengono mai caricati online.',
  },
};

export function t(lang, key, params = {}) {
  const s = (UI[lang] && UI[lang][key]) ?? UI.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ''));
}
