# Arcane Cards

Printable D&D 5e spell cards with your own artwork. Load a JSON or CSV file and get a PDF ready to print: standard 63 × 88 mm cards (the Magic: The Gathering and Pokémon size), 9 per A4 page, in English or Italian.

Everything runs in the browser. GitHub Pages hosts the site, and GitHub Actions deploys it on every push to `main`.

## Publish on GitHub Pages

1. Create a GitHub repository and push this folder to the `main` branch.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`, or run the **Deploy to GitHub Pages** workflow by hand. The site is published at `https://<user>.github.io/<repository>/`.

## Use the generator

1. Upload a JSON or CSV file, paste the data, or click **Load example**. The page offers templates in English, Italian and bilingual form.
2. Optionally pick local image files and reference them by file name in the `image` field.
3. Tick **Cards in Italian** to print the Italian version, then click **Generate PDF**.
4. Print the PDF at **100 % / actual size**. Do not use "fit to page", or the cards come out smaller.

## Data format

Each spell is one JSON object or one CSV row. Column names are accepted in English or Italian:

| Field | Italian | Notes |
| --- | --- | --- |
| `name` | `nome` | Required |
| `level` | `livello` | 0 (cantrip) to 9 |
| `school` | `scuola` | English or Italian school name |
| `ritual` | `rituale` | `true` / `false` |
| `casting_time` | `tempo_di_lancio` | |
| `range` | `gittata` | |
| `components` | `componenti` | |
| `duration` | `durata` | |
| `description` | `descrizione` | Supports `**bold**`, `*italic*`, new lines and `- ` bullets |
| `higher_levels` | `ai_livelli_superiori` | Optional |
| `image` | `immagine` | URL, repository path or local file name |
| `image_position` | `posizione_immagine` | `top`, `center` or `bottom` |
| `classes` | `classi` | Optional footer |
| `color` | `colore` | Optional card colour (CSS name or #hex), overrides the school colour |
| `copies` | `copie` | Number of copies, default 1 |

Add `_en` or `_it` to any field (`name_it`, `description_en`) to keep both languages in one file. The language checkbox picks which one is printed, and falls back to the unsuffixed field. See `site/decks/sample-spells.json`.

A file in a single language works too: unsuffixed fields are printed whatever the checkbox says, and the checkbox then only changes the labels and school names.

JSON can be an array of spells or an object `{ "spells": [...] }`. CSV can use commas or semicolons.

## Custom labels and colours

Step 4 of the page is optional. Tick **Use custom labels and colours** and the editor shows the full default settings as JSON. Edit it in place; **Reset to defaults** restores it. Lines you remove keep their default.

```json
{
  "labels": {
    "en": { "casting_time": "Casting Time", "level_line": "{ordinal}-level {school_lower}" },
    "it": { "casting_time": "Tempistiche", "evocation": "Invocazione" }
  },
  "colors": { "evocation": "firebrick", "divination": "#2e8b57", "unknown": "dimgray" }
}
```

- **Label keys:** `casting_time`, `range`, `components`, `duration`, `higher_levels`, `ritual`, `cantrip_badge`, `level_line`, `cantrip_line`, `no_school`, and the school names (`evocation`, `abjuration`…). `level_line` and `cantrip_line` accept `{level}`, `{ordinal}`, `{school}` and `{school_lower}`.
- **Colours:** any CSS colour name (`crimson`, `navy`, `seagreen`…), `#hex`, `rgb()` or `hsl()`. `unknown` is used for spells without a known school.
- The same `labels` and `colors` objects can also sit in a spell JSON file (`{ "labels": {...}, "colors": {...}, "spells": [...] }`). The step 4 editor wins over them.

## Colours

Each school of magic has a fixed default colour: Abjuration `royalblue`, Conjuration `chocolate`, Divination `teal`, Enchantment `mediumvioletred`, Evocation `firebrick`, Illusion `rebeccapurple`, Necromancy `darkolivegreen`, Transmutation `darkgoldenrod`, unknown school `dimgray`. Change them in step 4, or give a single spell its own colour with the `color` (`colore`) field. The **Black & white** option converts frames and artwork to grayscale. Each colour keeps a distinct shade of gray.

## Images

- **Online URLs.** The browser downloads the image to embed it in the PDF, so the host must allow cross-origin requests. When a host blocks it, the generator retries through the public `images.weserv.nl` proxy. You can turn that off in the options.
- **Images in this repository.** Put files in `site/images/` and use a relative path such as `images/fireball.svg`. This always works.
- **Local files or a zip.** Pick image files or a `.zip` of images in step 2 and use the file name in the `image` field (`fireball.jpg`). Folders inside the zip are ignored for matching, and names are not case-sensitive.

Local images and zip files are never uploaded. GitHub Pages only serves static files, so there is no server to send them to: the browser unpacks them, keeps them in memory, and discards them on **Clear images**, reload or close. A bare file name that is not loaded locally is reported as missing and is never looked up on the network. The generated PDF contains its own copy of each image.

Images are cropped to fill the art box (about 56 × 24 mm, roughly 2.3:1). Use `image_position` to keep the top or bottom of a tall image.

## Decks in the repository

Every `.json` or `.csv` file in `site/decks/` is listed in the **Decks in this repository** menu. The workflow rebuilds `site/decks/index.json` on each deploy.

## Local development

```sh
python3 -m http.server -d site 8000
```

Open <http://localhost:8000>. A local server is needed because the site uses ES modules.

## Licence notes

The sample spell texts come from the System Reference Document 5.1 by Wizards of the Coast LLC, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The Italian texts are adapted translations. The sample artwork in `site/images/` is original.
