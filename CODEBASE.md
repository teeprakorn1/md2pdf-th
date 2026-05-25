# Codebase

> Architecture overview and file map for md2pdf-th v4.0.3.

---

## Project tree

```
md2pdf-th/
├── md2pdf.js                  # CLI entry point — args, batch, watch, serve, merge
├── lib/
│   ├── md2pdf-core.js         # Core engine — convert, sanitize, TOC, cover, metadata, watermark
│   └── nestjs/
│       ├── index.js            # NestJS entry — re-exports Module + Service
│       ├── md2pdf.module.js    # Md2PdfModule — forRoot() / forRootAsync() DI
│       └── md2pdf.service.js   # Md2PdfService — convert, merge, getVersion
├── templates/
│   ├── resume.css              # Resume/CV template
│   ├── report.css              # Business report template
│   └── invoice.css             # Invoice template
├── types/
│   ├── index.d.ts              # TypeScript definitions — core API
│   └── nestjs.d.ts             # TypeScript definitions — NestJS module
├── test/
│   ├── unit.test.js            # Unit tests — sanitize, escape, title, TOC, frontmatter, cover, metadata, watermark
│   ├── nestjs.test.js          # NestJS module/service tests (mocked core)
│   └── md2pdf.test.js          # Integration tests — CLI end-to-end
├── md/
│   ├── example-basic.md        # Example — headings, tables, lists, blockquotes
│   ├── example-code.md         # Example — code blocks, bar charts, skill rating
│   └── example-tables.md       # Example — complex tables, Thai/English mixed
├── style.css                   # Light theme — CSS custom property vars only
├── style-dark.css              # Dark theme — CSS custom property vars only
├── style-base.css              # Shared layout rules (body, headings, tables, TOC, cover)
├── web-ui.html                 # Web UI — drag & drop .md → download PDF
├── Dockerfile                  # Docker image — Node 20 + Chromium + Thai fonts
├── action.yml                  # GitHub Action definition
├── md2pdf.bat                  # Windows batch launcher
├── package.json                # npm metadata, scripts, dependencies
├── CHANGELOG.md                # Version history
├── README.md                   # Project overview & quick start
├── USAGE.md                    # Extended usage guide
├── DEPLOY.md                   # Deployment guide
├── CONTRIBUTING.md             # Contribution guidelines
├── SECURITY.md                 # Security policy
├── CODE_OF_CONDUCT.md          # Contributor Covenant v2.1
└── LICENSE                     # Apache License 2.0
```

---

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌───────────┐     ┌─────────┐
│  CLI / API   │────▶│  Core Engine      │────▶│  md-to-pdf │────▶│ Puppeteer│
│  md2pdf.js   │     │  md2pdf-core.js   │     │  (marked)  │     │(Chromium)│
└──────────────┘     └──────────────────┘     └───────────┘     └─────────┘
       │                     │                                        │
       │                     ▼                                        ▼
       │              ┌──────────────┐                          ┌─────────┐
       │              │   pdf-lib     │◀────────────────────────│  PDF    │
       │              │  (post-proc)  │  merge, metadata,       │ Buffer  │
       │              └──────────────┘  watermark               └─────────┘
       │
       ▼
┌──────────────┐
│   NestJS     │
│   Module     │
│  (optional)  │
└──────────────┘
```

### Data flow

1. **Input** — Markdown string or file path
2. **Frontmatter** — `parseFrontmatter()` extracts YAML metadata, `stripFrontmatter()` removes it
3. **TOC** — `generateToc()` builds HTML table of contents from headings (before sanitization)
4. **Cover page** — `generateCoverPage()` creates HTML cover from frontmatter fields
5. **Sanitization** — `sanitizeHtml()` strips dangerous elements (script, iframe, SVG, events)
6. **Conversion** — `md-to-pdf` renders Markdown → HTML → PDF via Puppeteer/Chromium
7. **Post-processing** — `pdf-lib` adds metadata (`addPdfMetadata`), merges PDFs (`mergePdfBuffers`), applies watermark
8. **Output** — PDF Buffer returned or written to disk

---

## Module responsibilities

| File | Purpose | Exports |
|------|---------|---------|
| `md2pdf.js` | CLI entry point | `parseArgs`, `printUsage`, `buildCoreOptions`, `runWithConcurrency`, `startWatchMode`, `startServer`, `resolveOutputPath`, `checkRateLimit` |
| `lib/md2pdf-core.js` | Core conversion engine | `md2pdfTh`, `md2html`, `sanitizeHtml`, `escapeHtml`, `extractTitleFromContent`, `generateToc`, `generateCoverPage`, `parseFrontmatter`, `stripFrontmatter`, `addPdfMetadata`, `mergePdfBuffers`, `friendlyError`, `resolveOutputFilename`, `detectThaiContent`, `getFontStack`, `marked` |
| `lib/nestjs/index.js` | NestJS re-export | `Md2PdfModule`, `Md2PdfService` |
| `lib/nestjs/md2pdf.module.js` | NestJS DI module | `Md2PdfModule` (with `forRoot`, `forRootAsync`) |
| `lib/nestjs/md2pdf.service.js` | NestJS service wrapper | `Md2PdfService` (with `convert`, `convertFromContent`, `convertFromFile`, `convertToFile`, `merge`, `getVersion`) |

---

## Key functions — `lib/md2pdf-core.js`

| Function | Signature | Description |
|----------|-----------|-------------|
| `md2pdfTh` | `(options) → Promise<Buffer>` | Main conversion — accepts all options, returns PDF buffer |
| `md2html` | `(options) → Promise<Md2HtmlResult>` | Lightweight HTML export — no Puppeteer, returns `{html, css, title, ...}` |
| `sanitizeHtml` | `(html) → string` | Strip dangerous HTML (XSS protection) |
| `escapeHtml` | `(text) → string` | Escape HTML entities including `/` (OWASP) |
| `extractTitleFromContent` | `(content, maxLen, fallback) → string` | Extract first `# heading` as title |
| `generateToc` | `(content) → string` | Build HTML TOC from `##`+ headings with dedup slugs |
| `generateCoverPage` | `(title, author, date) → string` | HTML cover page block |
| `parseFrontmatter` | `(content) → FrontmatterMeta` | Parse YAML frontmatter to object |
| `stripFrontmatter` | `(content) → string` | Remove frontmatter block from content |
| `addPdfMetadata` | `(pdfBuffer, title, frontmatter) → Promise<Buffer>` | Set PDF title, author, subject, keywords, creator |
| `mergePdfBuffers` | `(buffers) → Promise<Buffer>` | Merge multiple PDF buffers into one |
| `friendlyError` | `(err) → string` | Null-safe error message extraction |
| `resolveOutputFilename` | `(pattern, inputPath) → string` | Expand `{name}`, `{date}`, `{time}`, `{timestamp}` |
| `detectThaiContent` | `(content) → boolean` | Check for Thai Unicode range |
| `getFontStack` | `(isThai) → string` | Return font-family CSS with Thai fallbacks |

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `md-to-pdf` | `^5.2.4` | Core Markdown → PDF conversion via Puppeteer + marked |
| `pdf-lib` | `^1.17.1` | PDF post-processing — metadata, merge, watermark |
| `marked` | `~15.0.0` | Markdown parser (re-exported from md-to-pdf, pinned to 15.x) |

### Peer dependencies (optional)

| Package | Version | Purpose |
|---------|---------|---------|
| `@nestjs/common` | `>=8.0.0` | NestJS integration — decorators, DI |
| `@nestjs/core` | `>=8.0.0` | NestJS integration — module system |

---

## CSS architecture

| File | Purpose | Lines |
|------|---------|-------|
| `style-base.css` | Shared layout — body, headings, tables, code, blockquote, TOC, cover | ~84 |
| `style.css` | Light theme `:root` CSS variables (`--bg`, `--text`, etc.) | ~27 |
| `style-dark.css` | Dark theme `:root` CSS variables (overrides colors) | ~27 |
| `templates/*.css` | Template-specific styles (self-contained, no base needed) | varies |

The core engine composes CSS at runtime: `theme vars + base layout`. CSS files are cached in memory with mtime-based invalidation via `readCssCached()`.

---

## Test structure

| File | Type | Count | Runner |
|------|------|-------|--------|
| `test/unit.test.js` | Unit | 55 | Built-in (no framework) |
| `test/nestjs.test.js` | NestJS | 8 | Built-in (mocked core) |
| `test/md2pdf.test.js` | Integration | ~20 | Built-in (`child_process.execSync`) |

Run all tests:

```bash
npm test                    # unit + nestjs + integration
npm run test:unit           # unit only
npm run test:nestjs         # nestjs only
npm run test:integration    # integration only
```

Unit tests cover core functions without Puppeteer. NestJS tests mock `md2pdfTh` to verify module/service wiring. Integration tests run the CLI end-to-end.
