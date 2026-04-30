# Changelog

All notable changes to **md2pdf-th** will be documented in this file.

## [3.2.0] — 2026-04-30

### Fixed
- 🔴 **Rate limit reset**: Per-IP rate limit with 60s sliding window (resets automatically) — was global counter that never reset
- 🔴 **Rate limit per-IP**: Each IP tracked independently — one attacker can no longer block the server
- 🔴 **Web server auth**: Random auth token generated on start, displayed in console
- 🟡 **Frontmatter multi-line**: Supports YAML block scalar (`|`) and quoted values (`"..."`, `'...'`)
- 🟡 **TOC id dedup**: Duplicate heading names get `-N` suffix (e.g. `intro`, `intro-1`)
- 🟡 **noPageNumbers vs header**: `--no-page-numbers` hides page numbers only; custom `--header`/`--footer` still show
- 🟡 **Cover+TOC insert**: Fixed `indexOf("</div>")` bug — now finds cover-page closing tag specifically
- 🟡 **Watch debounce**: Proper `setTimeout`/`clearTimeout` debounce instead of manual timestamp check
- 🟡 **Serve images**: Web server now serves image files (png, jpg, gif, svg, webp, ico) from markdown's directory
- 🟢 **escapeHtml**: Added `/` → `&#x2F;` per OWASP recommendation
- 🟢 **CSS variables**: Both `style.css` and `style-dark.css` now use CSS custom properties for shared rules

### Added
- 3 new unit tests: frontmatter quoted, block scalar, TOC dedup

## [3.1.0] — 2026-04-30

### Fixed
- 🔴 **NestJS Module**: Rewrote with proper DI pattern — `Md2PdfModule.forRoot()` / `forRootAsync()` now correctly registers `Md2PdfService` with `global: true`
- 🔴 **_defaults merge**: `Md2PdfService` now merges defaults from `forRoot()` into all method calls (`convert`, `convertFromContent`, `convertFromFile`, `convertToFile`)
- 🔴 **Web server security**: Added rate limiting (100 req/session), bind to `127.0.0.1` only, 404 for unknown paths
- 🟡 **Duplicate marked import**: CLI now imports `marked` locally in `startServer()` only, core functions imported from engine
- 🟡 **addPdfMetadata error logging**: Changed from silent catch to `console.warn()` with error message
- 🟡 **CI release action**: Replaced deprecated `actions/create-release@v1` with `softprops/action-gh-release@v2`
- 🟡 **parseFrontmatter**: Now supports `title:`, `tags:`, `description:` in addition to `author:` and `date:`
- 🟢 **VERSION hardcoded**: Now reads from `package.json` via `require("../package.json").version`
- 🟢 **eslint placeholder**: Removed — was a no-op echo script
- 🟢 **Cover page uses frontmatter.title**: If `title:` is in frontmatter, it's used for cover instead of h1

### Added
- 🟢 **TypeScript types**: `types/index.d.ts` + `types/nestjs.d.ts` — full type definitions
- 🟡 **Unit tests**: `test/unit.test.js` — 21 tests for core functions (sanitize, escape, title, frontmatter, TOC, cover) — no Puppeteer required
- 🟡 **Test scripts**: `npm run test:unit` and `npm run test:integration` for targeted runs

## [3.0.0] — 2026-04-30

### Changed
- **Architecture refactor**: Separated core engine (`lib/md2pdf-core.js`) from CLI (`md2pdf.js`)
- **Library API**: `md2pdfTh()` function returns `Buffer` — usable from any Node.js code
- **NestJS module**: `Md2PdfModule` + `Md2PdfService` for dependency injection
- **package.json exports**: `require('md2pdf-th')` → core engine, `require('md2pdf-th/nestjs')` → NestJS

### Added
- 🌙 `--theme dark` / `theme: 'dark'` — Dark mode PDF with `style-dark.css`
- 📋 `--toc` / `toc: true` — Auto-generated Table of Contents from headings
- 🖼️ `--cover` / `cover: true` — Cover page from YAML frontmatter
- 📄 `--merge` / `mergePdfBuffers()` — Merge multiple PDFs into one
- 👀 `--watch` — Watch mode, auto-reconvert on file change
- 🌐 `--serve` / `--port` — Live HTML preview web server
- 🔧 `--header` / `--footer` — Custom header/footer text
- 📐 `--format` — Page sizes: A3, A4, A5, Letter, Legal, Tabloid
- 🔤 `--font` — Custom font family injection
- 📊 PDF metadata via `pdf-lib` (Title, Author, Subject, Keywords, Creator)
- 🧹 Enhanced HTML sanitization (SVG, math, style, details, javascript:, vbscript:)
- 🔒 Path traversal validation for `--css`, `--outdir`, input files
- 🛡️ `--no-sandbox` only in CI environment (`process.env.CI`)

### Security
- Cover page XSS fix — `escapeHtml()` applied to title, author, date
- Expanded `sanitizeHtml()` — strips `<svg>`, `<math>`, `<style>`, `<details>`, `javascript:`, `vbscript:`, `data:text/html`
- Web server binds to `127.0.0.1` only with auth warning

## [2.0.0] — 2026-04-30

### Added
- 10 new features: dark theme, TOC, cover page, merge, watch mode, web server, custom header/footer, page format, custom font, PDF metadata
- `style-dark.css` — Dark mode stylesheet
- PDF metadata injection via `pdf-lib`
- Concurrency control for batch mode
- HTML sanitization for XSS prevention

### Fixed
- CI Chrome dependencies for Ubuntu 24.04 Noble (`t64` packages)
- `--no-sandbox` for headless Chrome in CI
- `addPdfMetadata` uses `pdf-lib` instead of fragile binary string replace
- `runWithConcurrency` race condition fix
- Frontmatter parsed before stripping (correct order)
- Watch mode error handling with retry

## [1.0.1] — 2026-04-30

### Fixed
- `bin` entry in `package.json` corrected for `npx` compatibility
- CI workflow: removed `cache: npm`, changed `npm ci` to `npm install`
- Added `.npmrc` to `.gitignore` to prevent token leaks

## [1.0.0] — 2026-04-30

### Added
- Initial release
- CLI tool: `md2pdf-th <file.md>`
- Thai font support (Leelawadee, Tahoma, Noto Sans Thai)
- Page numbers with header title
- Custom CSS via `--css`
- Batch conversion
- Output directory via `--outdir`
- `--no-page-numbers` option
- HTML sanitization (script, iframe, object, embed, event handlers)
- PDF metadata injection
- GitHub Actions CI/CD pipeline
- npm publishing workflow
