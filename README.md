# md2pdf-th

> Markdown to PDF library & CLI — Thai/English support, dark theme, TOC, cover page, merge, watch mode, NestJS module

[![npm version](https://img.shields.io/npm/v/md2pdf-th.svg)](https://www.npmjs.com/package/md2pdf-th)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- 🇹🇭 **Thai language support** — Auto-detect Thai + mixed language, smart font fallback
- 🌙 **Dark theme** — `--theme dark` for dark mode PDFs
- 📋 **Table of Contents** — Auto-generated from headings with dedup anchors
- 🖼️ **Cover page** — From YAML frontmatter (title, author, date)
- 📄 **Merge PDFs** — Combine multiple markdown files into one PDF
- 👀 **Watch mode** — Auto-reconvert on file change (debounced)
- 🌐 **Web preview** — Live HTML preview server with auth token + image serving
- 🔧 **Custom header/footer** — `--header` / `--footer` text
- 📐 **Page sizes** — A3, A4, A5, Letter, Legal, Tabloid
- 🔤 **Custom fonts** — `--font "Georgia"` or any installed font
- 🎨 **Templates** — `--template resume|report|invoice` — ready-made styles
- � **Watermark** — `--watermark "CONFIDENTIAL"` diagonal text
- �📦 **Batch conversion** — Parallel processing with concurrency limit
- 🧹 **HTML sanitization** — XSS protection (script, iframe, SVG, event handlers)
- 🏗️ **Library API** — Use as Node.js library, returns Buffer
- 🪺 **NestJS module** — `Md2PdfModule` with DI support
- 📝 **TypeScript types** — Full `.d.ts` type definitions
- 🐳 **Docker** — `Dockerfile` with Chromium + Thai fonts
- ⚡ **GitHub Action** — Use in CI pipelines
- 🌍 **Web UI** — Drag & drop .md → download PDF

## Quick Start

### Using npx (no install)

```bash
npx md2pdf-th document.md
```

### Global install

```bash
npm install -g md2pdf-th
md2pdf-th document.md
```

## CLI Usage

```bash
md2pdf-th <file.md> [output.pdf]
md2pdf-th <file1.md> <file2.md> ...          # batch convert
md2pdf-th [options] <file.md>
```

### Options

| Option | Description |
|--------|-------------|
| `--css <path>` | Custom CSS file path |
| `--outdir, -o <dir>` | Output directory |
| `--no-page-numbers` | Disable page numbers |
| `--theme <light\|dark>` | Color theme (default: light) |
| `--toc` | Generate Table of Contents |
| `--watch` | Watch mode — reconvert on file change |
| `--merge` | Merge multiple PDFs into one |
| `--cover` | Add cover page from frontmatter |
| `--header <text>` | Custom header text |
| `--footer <text>` | Custom footer text |
| `--format <size>` | Page size: A3, A4, A5, Letter, Legal, Tabloid |
| `--font <name>` | Custom font family |
| `--template <name>` | Built-in template: resume, report, invoice |
| `--watermark <text>` | Diagonal watermark text |
| `--output-filename <pattern>` | Output filename pattern: `{name}`, `{date}`, `{time}`, `{timestamp}` |
| `--serve` | Start web preview server |
| `--port <port>` | Server port (default: 3000) |
| `--version, -v` | Show version |
| `--help, -h` | Show help |

### Examples

```bash
# Single file
md2pdf-th doc.md

# Dark theme
md2pdf-th --theme dark doc.md

# TOC + cover page
md2pdf-th --toc --cover doc.md

# Custom header/footer
md2pdf-th --header "Company" --footer "Confidential" doc.md

# Letter format with Georgia font
md2pdf-th --format Letter --font Georgia doc.md

# Merge multiple files
md2pdf-th --merge doc1.md doc2.md doc3.md

# Watch mode
md2pdf-th --watch doc.md

# Web preview
md2pdf-th --serve --port 8080 doc.md

# Resume template
md2pdf-th --template resume resume.md

# Report with watermark
md2pdf-th --template report --watermark "DRAFT" report.md

# Custom output filename pattern
md2pdf-th --output-filename "{name}-{date}" -o ./pdfs *.md

# Batch convert
md2pdf-th -o ./pdfs *.md
```

## Library API

Use as a Node.js library — returns PDF Buffer:

```js
const { md2pdfTh } = require('md2pdf-th');

// From markdown string → Buffer
const pdfBuffer = await md2pdfTh({ content: '# สวัสดี' });

// From file → Buffer
const pdfBuffer = await md2pdfTh({ inputPath: 'doc.md' });

// From file → save to disk
await md2pdfTh({ inputPath: 'doc.md', outputPath: 'out.pdf' });

// With options
const pdfBuffer = await md2pdfTh({
  content: '# Hello',
  theme: 'dark',
  toc: true,
  cover: true,
  headerText: 'My Company',
  footerText: 'Confidential',
  format: 'Letter',
  font: 'Georgia',
  lang: 'th',
  template: 'report',
  watermark: 'DRAFT',
});
```

### Frontmatter (for --cover & options)

```yaml
---
title: My Document Title
author: John Doe
date: 2024-01-01
tags: report, quarterly
description: Quarterly report
theme: dark
toc: true
cover: true
format: A4
template: report
watermark: DRAFT
headerText: Company Name
footerText: Confidential
---

# Content starts here
```

All frontmatter options: `title`, `author`, `date`, `tags`, `description`, `theme`, `toc`, `cover`, `format`, `template`, `watermark`, `headerText`, `footerText`, `noPageNumbers`, `font`, `lang`

## NestJS Integration

```ts
import { Md2PdfModule, Md2PdfService } from 'md2pdf-th/nestjs';

@Module({
  imports: [Md2PdfModule.forRoot({ theme: 'dark' })],
})
class AppModule {}

@Injectable()
class ReportService {
  constructor(private md2pdf: Md2PdfService) {}

  async generateReport() {
    const pdf = await this.md2pdf.convertFromContent('# Report');
    return pdf; // Buffer
  }
}
```

Async configuration:

```ts
Md2PdfModule.forRootAsync({
  useFactory: (config: ConfigService) => config.get('md2pdf'),
  inject: [ConfigService],
})
```

## Custom CSS

Default stylesheet is bundled. Override with `--css` or `css` option:

```bash
md2pdf-th --css my-style.css doc.md
```

Or via API:

```js
await md2pdfTh({ content: '# Hello', css: 'h1 { color: red; }' });
```

## API Reference

### `md2pdfTh(options)` → `Promise<Buffer>`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `content` | `string` | — | Markdown content string (alternative to `inputPath`) |
| `inputPath` | `string` | — | Path to .md file (alternative to `content`) |
| `outputPath` | `string` | — | Output PDF path. If omitted, returns Buffer |
| `css` | `string` | — | Custom CSS string |
| `cssPath` | `string` | — | Path to custom CSS file |
| `theme` | `'light'\|'dark'` | `'light'` | Color theme |
| `toc` | `boolean` | `false` | Generate Table of Contents |
| `cover` | `boolean` | `false` | Add cover page from frontmatter |
| `headerText` | `string` | — | Custom header text |
| `footerText` | `string` | — | Custom footer text |
| `format` | `string` | `'A4'` | Page size: A3, A4, A5, Letter, Legal, Tabloid |
| `font` | `string` | — | Custom font family |
| `noPageNumbers` | `boolean` | `false` | Disable page numbers |
| `lang` | `'th'\|'en'` | `'th'` | Language hint for font selection |
| `template` | `string` | — | Built-in template: resume, report, invoice |
| `watermark` | `string` | — | Diagonal watermark text |
| `outputFilename` | `string` | — | Output filename pattern (`{name}`, `{date}`, `{time}`, `{timestamp}`) |

### `mergePdfBuffers(buffers)` → `Promise<Buffer>`

Merge multiple PDF buffers into one.

### `sanitizeHtml(content)` → `string`

Strip dangerous HTML (script, iframe, SVG, event handlers, etc.).

### `parseFrontmatter(content)` → `FrontmatterMeta`

Parse YAML frontmatter. Returns `{ title, author, date, tags, description, rawLength }`.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## Docker

```bash
# Build
docker build -t md2pdf-th .

# Convert
docker run --rm -v $(pwd):/data md2pdf-th /data/doc.md /data/output.pdf

# With options
docker run --rm -v $(pwd):/data md2pdf-th --template report --toc /data/doc.md
```

## GitHub Action

Use in your CI pipeline:

```yaml
- uses: teeprakorn1/md2pdf-th@v4
  with:
    markdown-file: report.md
    output-file: report.pdf
    theme: dark
    format: A4
    toc: true
    template: report
    watermark: DRAFT
```

Or install via npm in your workflow:

```yaml
- run: npm install -g md2pdf-th
- run: md2pdf-th --toc --cover report.md
```

## Requirements

- Node.js >= 16.0.0
- Chromium (auto-installed by Puppeteer via `md-to-pdf`)

## License

MIT © Teepakorn Kumvong
