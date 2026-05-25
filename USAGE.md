# Usage guide

> Extended usage guide for md2pdf-th. For quick start, see [README.md](README.md).

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PUPPETEER_EXECUTABLE_PATH` | (auto) | Path to Chromium/Chrome binary. Set when using system Chromium instead of Puppeteer's bundled version |
| `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` | `false` | Skip downloading Chromium during `npm install`. Use with system Chromium |
| `CI` | — | When set, enables `--no-sandbox` for Puppeteer (required in Docker/CI) |

**Docker example:**

```bash
docker run --rm \
  -e PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
  -e CI=true \
  -v $(pwd):/data md2pdf-th /data/doc.md
```

---

## Advanced CLI

### Output filename patterns

Use `--output-filename` with placeholders:

| Placeholder | Expands to | Example |
|-------------|-----------|---------|
| `{name}` | Input filename (without extension) | `report` |
| `{date}` | Current date (`YYYY-MM-DD`) | `2026-05-25` |
| `{time}` | Current time (`HH-MM-SS`) | `14-30-00` |
| `{timestamp}` | Unix timestamp | `1748150400` |

```bash
md2pdf-th --output-filename "{name}-{date}" -o ./pdfs report.md
# Output: ./pdfs/report-2026-05-25.pdf

md2pdf-th --output-filename "{name}-v{timestamp}" doc.md
# Output: doc-v1748150400.pdf
```

### Batch conversion

Convert multiple files with glob patterns:

```bash
md2pdf-th -o ./pdfs *.md                    # all .md in current dir
md2pdf-th -o ./pdfs docs/*.md               # all .md in docs/
md2pdf-th --theme dark -o ./pdfs *.md       # batch with options
```

Batch conversion runs in parallel with a concurrency limit (default: 4). Control with `--concurrency`:

```bash
md2pdf-th --concurrency 8 -o ./pdfs *.md     # 8 parallel conversions
md2pdf-th --concurrency 1 -o ./pdfs *.md     # sequential (1 at a time)
```

Files are processed independently — one failure does not stop the others.

### Merge mode

Combine multiple Markdown files into a single PDF:

```bash
md2pdf-th --merge chapter1.md chapter2.md chapter3.md
# Output: chapter1.pdf (merged)

md2pdf-th --merge -o ./out intro.md body.md appendix.md
# Output: ./out/intro.pdf (merged)
```

Each file is converted to PDF individually, then all PDFs are merged using `pdf-lib` in the order specified.

---

## Frontmatter reference

All 16 supported frontmatter fields:

```yaml
---
title: My Document Title          # Cover page title (string)
author: John Doe                  # Cover page author + PDF metadata (string)
date: 2026-01-01                  # Cover page date (string)
tags: report, quarterly           # PDF metadata keywords (comma-separated string)
description: Quarterly report     # PDF metadata subject (string)
theme: dark                       # Color theme: light | dark (default: light)
toc: true                         # Generate Table of Contents (boolean: true/yes/on/1)
cover: true                       # Add cover page (boolean: true/yes/on/1)
format: A4                        # Page size: A3 | A4 | A5 | Letter | Legal | Tabloid
template: report                  # Built-in template: resume | report | invoice
watermark: DRAFT                  # Diagonal watermark text (string)
headerText: Company Name          # Custom header text (string)
footerText: Confidential          # Custom footer text (string)
noPageNumbers: false              # Disable page numbers (boolean)
font: Georgia                     # Custom font family (string)
lang: th                          # Language hint: th | en (default: th)
---
```

**Boolean handling:** Accepts `true`, `yes`, `on`, `1` as truthy values (YAML 1.1 spec).

**Priority:** Frontmatter values override CLI flags. For example, `theme: dark` in frontmatter takes precedence over `--theme light` on the command line.

---

## Template customization

### Built-in templates

Three templates are included in the `templates/` directory:

| Template | Use case | File |
|----------|----------|------|
| `resume` | CV / resume with clean typography | `templates/resume.css` |
| `report` | Business reports with headers | `templates/report.css` |
| `invoice` | Invoice layout with tables | `templates/invoice.css` |

```bash
md2pdf-th --template resume resume.md
md2pdf-th --template report --watermark "DRAFT" report.md
```

### Custom CSS override

Override the default stylesheet entirely:

```bash
md2pdf-th --css my-style.css doc.md
```

Or via the library API:

```js
const pdf = await md2pdfTh({
  content: '# Hello',
  css: 'h1 { color: navy; font-size: 2em; }',
});
```

The `css` option accepts a CSS string. The `cssPath` option accepts a file path. Both override the default `style.css` or `style-dark.css`.

---

## Web preview server

Start a live HTML preview with auto-reload:

```bash
md2pdf-th --serve doc.md                   # default port 3000
md2pdf-th --serve --port 8080 doc.md       # custom port
```

### How it works

1. Server starts at `http://localhost:<port>?token=<random>`
2. An **auth token** is generated and printed to the console — the URL includes it as a query parameter
3. The Markdown file is rendered as HTML with the same CSS used for PDF
4. **Auto-reload** — file changes trigger re-render (debounced at 500ms)
5. **Image serving** — images referenced in Markdown are served relative to the input file directory
6. **Rate limiting** — per-IP rate limiting with 60s sliding window

### Security

- The token is required for all requests — unauthenticated requests return 403
- Path traversal is blocked — only files within the input directory are served
- Images are validated against the input directory boundary

---

## Watch mode

Auto-reconvert on file change:

```bash
md2pdf-th --watch doc.md
md2pdf-th --watch --theme dark doc.md
```

- Uses `fs.watchFile` (polling at 500ms) for cross-platform reliability
- Debounced at 500ms to avoid duplicate conversions during rapid saves
- Press `Ctrl+C` to stop

---

## Language detection

md2pdf-th automatically detects Thai content and injects appropriate fonts.

### How it works

1. `detectThaiContent(content)` scans for Thai Unicode characters (`\u0E00-\u0E7F`)
2. If Thai is detected, `getFontStack()` prepends `"Sarabun", "Noto Sans Thai"` to the font stack
3. The `--lang` flag (`th` or `en`) can override auto-detection

```bash
md2pdf-th --lang en doc.md    # Force English font stack
md2pdf-th --lang th doc.md    # Force Thai font stack (default)
```

### Watermark limitation

Watermarks use the Helvetica font embedded in PDF, which **does not support Thai glyphs**. If Thai content is detected, the watermark is automatically skipped to avoid garbled text.

---

## Troubleshooting

### Chromium not found

```
Error: Could not find Chromium
```

**Fix:** Install Chromium or set the path:

```bash
# Option 1: Let Puppeteer download it
npm install puppeteer

# Option 2: Use system Chromium
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

### Port already in use (EADDRINUSE)

```
Error: Port 3000 is already in use
```

**Fix:** Use a different port:

```bash
md2pdf-th --serve --port 8080 doc.md
```

### Thai text garbled or missing

**Cause:** Thai fonts not installed on the system.

**Fix:**

```bash
# Ubuntu/Debian
sudo apt-get install fonts-noto fonts-noto-cjk

# Or use Docker (fonts pre-installed)
docker run --rm -v $(pwd):/data md2pdf-th /data/doc.md
```

### PDF is blank or empty

**Cause:** Usually an empty Markdown file or frontmatter-only content.

**Fix:** Ensure the file has content after the frontmatter block (`---`). The closing `---` must be followed by a newline.

### Watch mode not detecting changes

**Cause:** Some editors use atomic writes (write to temp file, then rename).

**Fix:** `fs.watchFile` (polling) is used by default, which handles this. If issues persist, save the file again or use `--serve` for web preview instead.
