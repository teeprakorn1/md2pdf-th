<div align="center">

<pre style="background:none;border:none;">
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   📄  MD2PDF-TH  —  Markdown to PDF for Thai & English      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
</pre>

<h1>md2pdf-th — Markdown to PDF</h1>

<p>
  <strong>Convert Markdown to beautiful PDFs with Thai/English support, dark theme, TOC, cover page, templates, watermark, and NestJS integration.</strong>
</p>

<p>
  <a href="https://www.npmjs.com/package/md2pdf-th"><img src="https://img.shields.io/npm/v/md2pdf-th?style=for-the-badge&color=0ea5e9&logo=npm&logoColor=white" alt="NPM Version"></a>
  <a href="https://www.npmjs.com/package/md2pdf-th"><img src="https://img.shields.io/npm/dt/md2pdf-th?style=for-the-badge&color=8b5cf6&logo=npm&logoColor=white" alt="NPM Downloads"></a>
  <a href="https://github.com/teeprakorn1/md2pdf-th/blob/main/LICENSE"><img src="https://img.shields.io/github/license/teeprakorn1/md2pdf-th?style=for-the-badge&color=10b981&logo=opensourceinitiative&logoColor=white" alt="Apache 2.0 License"></a>
</p>

<p>
  <a href="https://github.com/teeprakorn1/md2pdf-th/commits/main"><img src="https://img.shields.io/github/last-commit/teeprakorn1/md2pdf-th?style=flat-square&color=64748b" alt="Last Commit"></a>
  <a href="https://github.com/teeprakorn1/md2pdf-th"><img src="https://img.shields.io/github/languages/top/teeprakorn1/md2pdf-th?style=flat-square&color=64748b" alt="Top Language JavaScript"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-16%20%7C%2018%20%7C%2020-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 16 18 20"></a>
  <a href="https://github.com/teeprakorn1/md2pdf-th/pulls"><img src="https://img.shields.io/badge/PRs-Welcome-ff69b4?style=flat-square&logo=git&logoColor=white" alt="PRs Welcome"></a>
</p>

<table align="center">
  <tr>
    <td align="center"><b>TH/EN</b><br>🇹🇭 Thai Support</td>
    <td align="center"><b>3</b><br>🎨 Templates</td>
    <td align="center"><b>6</b><br>📐 Page Sizes</td>
    <td align="center"><b>2</b><br>🌓 Themes</td>
    <td align="center"><b>NestJS</b><br>🔗 Module</td>
    <td align="center"><b>CI/CD</b><br>🐳 Docker + Action</td>
  </tr>
</table>

</div>

---

**md2pdf-th** is an open-source Markdown-to-PDF converter with first-class Thai language support. It works as a **CLI tool**, **Node.js library**, and **NestJS module** — featuring auto font detection, YAML frontmatter, HTML sanitization, batch conversion, watch mode, web preview, and PDF merging. Powered by Puppeteer via `md-to-pdf` with `pdf-lib` for metadata, watermarks, and merging.

> **Latest Release: v4.0.3** — 19 bug fixes (3 Critical + 5 High + 6 Medium + 5 Low), 12 new regression tests, JSDoc documentation for all functions. See [CHANGELOG.md](CHANGELOG.md).

---

## Table of contents

- [What's new in V4](#whats-new-in-v4)
- [Quick start](#quick-start)
- [Why md2pdf-th?](#why-md2pdf-th)
- [CLI reference](#cli-reference)
- [Library API](#library-api)
- [NestJS integration](#nestjs-integration)
- [API reference](#api-reference)
- [Docker](#docker)
- [GitHub Action](#github-action)
- [Project structure](#project-structure)
- [Requirements](#requirements)
- [Contributing](#contributing)
- [License](#license)

---

## What's new in V4

V4 brings a **complete rewrite** of the core engine with Thai-first design, YAML frontmatter options, built-in templates, PDF watermarking, web preview server, and NestJS integration.

| Area | Change | Impact |
|------|--------|--------|
| V4.0.3 Bug Audit | 19 bug fixes — frontmatter merge, XSS sanitizer, action.yml RCE, path traversal, watermark API | Stability ⬆️ |
| V4.0.2 Concurrency | Deadlock fix, rate limit hardening, path traversal protection | Reliability ⬆️ |
| V4.0.0 Rewrite | New core engine, frontmatter options, templates, watermark, web preview, NestJS module | Features ⬆️ |

<details>
<summary><b>V4.0.3 — 19 Bug Fixes (Latest)</b></summary>

**Critical:** Frontmatter merge ignoring CLI flags (`_explicitKeys`), sanitizeHtml XSS bypass (unclosed tags), action.yml expression injection (RCE)

**High:** Image serving path traversal, web-ui.html broken import, output path detection, `--no-page-numbers` + `--header` conflict, `embedFont` wrong API

**Medium:** Regex EOF/sync issues, quoted value parsing, null guard, NestJS content override, CI split

**Low:** TypeScript types, import path comment, Tabloid dropdown

Plus 12 regression tests and JSDoc for all functions.

</details>

---

## Quick start

```bash
# Using npx (no install)
npx md2pdf-th document.md

# Global install
npm install -g md2pdf-th
md2pdf-th document.md

# Dark theme + TOC + cover
md2pdf-th --theme dark --toc --cover doc.md

# Use as library
const { md2pdfTh } = require('md2pdf-th');
const pdf = await md2pdfTh({ content: '# สวัสดี', theme: 'dark' });
```

<details>
<summary><b>🐳 Or Use Docker</b></summary>

```bash
docker build -t md2pdf-th .
docker run --rm -v $(pwd):/data md2pdf-th /data/doc.md /data/output.pdf
```
</details>

---

## Installation Options

### Lightweight install (skip Chromium download)

If you already have Chromium/Chrome on your system:

```bash
# Skip Puppeteer's Chromium download (~150MB saved)
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install -g md2pdf-th

# Point to system Chrome
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
md2pdf-th doc.md
```

| Platform | System Chrome Path |
|----------|-------------------|
| Linux (Debian/Ubuntu) | `/usr/bin/chromium` or `/usr/bin/chromium-browser` |
| macOS | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |
| Windows | `C:\Program Files\Google\Chrome\Application\chrome.exe` |

### Docker (no install needed)

```bash
# Build once, reuse
# docker build -t md2pdf-th .
docker run --rm -v $(pwd):/data md2pdf-th /data/doc.md /data/output.pdf
```

### CI environments

```bash
# CI environments need --no-sandbox (auto-detected via CI=true env)
CI=true md2pdf-th doc.md
```

---

## Why md2pdf-th?

### The problem

Converting Markdown to PDF with proper Thai language support is painful — most tools break Thai line wrapping, use wrong fonts, or lack professional formatting options. Developers end up fighting with LaTeX or building custom Puppeteer scripts.

### The solution

md2pdf-th is a **zero-config Markdown to PDF converter** that handles Thai and English content out of the box:

- **🇹🇭 Thai-First Design** — Auto-detect Thai content ratio, smart font fallback (Leelawadee → Noto Sans Thai → Tahoma)
- **🎨 Professional Output** — Dark theme, 3 built-in templates (resume, report, invoice), custom fonts
- **📑 Document Features** — TOC, cover page from frontmatter, header/footer, page numbers, watermark
- **⚡ Developer Experience** — CLI, library API, NestJS module, watch mode, web preview, batch conversion
- **🔒 Security** — HTML sanitization (XSS), path traversal protection, auth token for web server
- **🐳 CI/CD Ready** — Docker image, GitHub Action, TypeScript types

---

## CLI reference

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
| `--concurrency <n>` | Batch concurrency limit 1-32 (default: 4) |
| `--serve` | Start web preview server |
| `--port <port>` | Server port (default: 3000) |
| `--html-only` | Export HTML instead of PDF (lightweight, no Puppeteer) |
| `--timeout <ms>` | Conversion timeout in milliseconds (default: 60000) |
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

---

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

### Custom CSS

Default stylesheet is bundled. Override with `--css` or `css` option:

```bash
md2pdf-th --css my-style.css doc.md
```

```js
await md2pdfTh({ content: '# Hello', css: 'h1 { color: red; }' });
```

---

## NestJS integration

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

<details>
<summary><b>Async Configuration</b></summary>

```ts
Md2PdfModule.forRootAsync({
  useFactory: (config: ConfigService) => config.get('md2pdf'),
  inject: [ConfigService],
})
```
</details>

---

## API reference

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

Parse YAML frontmatter. Returns `{ title, author, date, tags, description, theme, toc, cover, format, ... }`.

---

## Docker

```bash
# Build
docker build -t md2pdf-th .

# Convert
docker run --rm -v $(pwd):/data md2pdf-th /data/doc.md /data/output.pdf

# With options
docker run --rm -v $(pwd):/data md2pdf-th --template report --toc /data/doc.md
```

---

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

<details>
<summary><b>Or Install via npm</b></summary>

```yaml
- run: npm install -g md2pdf-th
- run: md2pdf-th --toc --cover report.md
```
</details>

---

## Project structure

```
md2pdf-th/
├── md2pdf.js                    # CLI entry point
├── lib/
│   ├── md2pdf-core.js           # Core engine (sanitize, TOC, cover, watermark, metadata)
│   └── nestjs/
│       ├── md2pdf.module.js     # NestJS module (forRoot, forRootAsync)
│       ├── md2pdf.service.js    # NestJS service wrapper
│       └── index.js             # NestJS entry point
├── types/
│   ├── index.d.ts               # TypeScript definitions (core)
│   └── nestjs.d.ts              # TypeScript definitions (NestJS)
├── templates/
│   ├── resume.css               # Resume template
│   ├── report.css               # Report template
│   └── invoice.css              # Invoice template
├── style.css                    # Light theme (CSS vars only)
├── style-dark.css               # Dark theme (CSS vars only)
├── style-base.css               # Shared layout rules
├── web-ui.html                  # Web UI (drag & drop)
├── md/                          # Example markdown files
├── test/
│   ├── unit.test.js             # Unit tests (55 tests)
│   ├── nestjs.test.js           # NestJS module/service tests (8 tests)
│   └── md2pdf.test.js           # Integration tests (19 tests)
├── action.yml                   # GitHub Action definition
├── Dockerfile                   # Docker with Chromium + Thai fonts
└── package.json                 # npm package config
```

---

## Requirements

- Node.js >= 16.0.0
- Chromium (auto-installed by Puppeteer via `md-to-pdf`)

---

## Documentation

- [CHANGELOG.md](CHANGELOG.md) — Version history and bug fixes
- [USAGE.md](USAGE.md) — Extended usage guide, environment variables, troubleshooting
- [CODEBASE.md](CODEBASE.md) — Architecture, file map, module responsibilities
- [DEPLOY.md](DEPLOY.md) — Deployment guide (npm, Docker, CI/CD, NestJS)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

Apache-2.0 © Teepakorn Kumvong
