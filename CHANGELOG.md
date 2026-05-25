# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [4.0.2] - 2026-05-25

> **55 bug fixes** (8 Critical · 9 High · 19 Medium · 19 Low) · **44 regression tests** · CSS architecture rewrite · JSDoc documentation

### Security

- **[Critical] action.yml expression injection (RCE)** — `${{ inputs.* }}` interpolated in bash. Moved to `env:` block (`action.yml`)
- **[Critical] action.yml shell injection** — CLI args concatenated as string. Switched to bash arrays with quoting (`action.yml`)
- **[Critical] sanitizeHtml XSS bypass (unclosed tags)** — Unclosed `<script>`/`<svg>`/`<style>`/`<iframe>`/`<object>`/`<math>` passed through. Added fallback regexes (`lib/md2pdf-core.js`)
- **[Critical] sanitizeHtml ReDoS** — Catastrophic backtracking in `[\s\S]*`. Replaced with non-greedy `*?` (`lib/md2pdf-core.js`)
- **[High] Image serving path traversal** — Used pre-normalize path. Fixed to use `normalized`, added null-byte check (`md2pdf.js`)
- **[High] Output path traversal in batch mode** — No validation on positional output arg. Added `..` check (`md2pdf.js`)
- **[Medium] sanitizeHtml missing tags** — `<form>`, `<base>`, `<link>`, `<meta>` not stripped. Added patterns (`lib/md2pdf-core.js`)
- **[Medium] `data:image/svg+xml` bypass** — Only `data:text/html` blocked. Extended to SVG + xhtml URIs (`lib/md2pdf-core.js`)
- **[Medium] Backtick event handler bypass** — `` onclick=`alert(1)` `` not caught. Added backtick regex (`lib/md2pdf-core.js`)
- **[Low] `Math.random()` auth token** — Not cryptographic. Switched to `crypto.randomBytes()` (`md2pdf.js`)

### Fixed

**Core Engine** (`lib/md2pdf-core.js`)

- **[Critical] Frontmatter merge ignores CLI flags** — All keys pre-initialized, `"theme" in fm` always true. Added `_explicitKeys` Set
- **[High] `--no-page-numbers` + `--header` showed page numbers** — Restructured to use text-only template when `noPageNumbers` is true
- **[High] `embedFont("Helvetica")` wrong API** — pdf-lib requires `StandardFonts.Helvetica` enum, not string
- **[Medium] parseFrontmatter regex EOF** — EOF without trailing newline not matched. Changed to `(?:\r?\n|$)`
- **[Medium] stripFrontmatter regex mismatch** — Different boundary than parseFrontmatter. Synced patterns
- **[Medium] `_parseFmValue` mismatched quote types** — Single regex matched any pair. Split into double/single regexes
- **[Medium] `detectThaiContent` null crash** — Added `if (!content) return 0`
- **[Medium] Frontmatter boolean YAML spec** — Only `"true"` accepted. Added `_isTruthy()` for `"yes"`/`"on"`/`"1"`
- **[Medium] `_parseFmValue` inner quotes mangled** — `O'Brien` → `O Brien`. Changed to strip only outer quotes
- **[Medium] `addPdfMetadata` hardcoded** — Author/Keywords always static. Now reads frontmatter dynamically
- **[Medium] TOC slug mismatch with marked** — Added `slugify()` helper matching `marked`'s algorithm
- **[Medium] Frontmatter merge `||` ambiguity** — Can't distinguish empty from missing. Changed to `"prop" in fm`
- **[Medium] `friendlyError` null safety** — `err.message` threw on null. Changed to `err?.message ?? String(err)`
- **[Medium] TOC generated before sanitization** — Sanitizer mangled headings. Reordered: TOC → sanitize
- **[Medium] parseFrontmatter regex boundary** — Could match `---` in code blocks. Tightened delimiter
- **[Low] `extractTitleFromContent` strips emojis** — Changed to preserve emojis
- **[Low] `extractTitleFromContent` UTF-16 bug** — Switched to `[...title].length` for grapheme-aware counting
- **[Low] `addWatermark` Thai glyphs** — Helvetica lacks Thai. Added detection, returns original PDF with warning
- **[Low] Watermark multi-line** — `\n` rendered as tofu. Added line splitting with vertical offset
- **[Low] Header/footer color hardcoded** — Added per-theme `headerFooterColor`

**CLI** (`md2pdf.js`)

- **[Critical] `runWithConcurrency` deadlock** — Promise not removed from Set on error. Added `.finally(() => executing.delete(promise))`
- **[Critical] `checkRateLimit` Map mutation** — Purging inside `for...of` skipped entries. Collect-then-delete
- **[High] Output path detection** — Only checked index 1. Changed to find first `.pdf` in args
- **[High] `convertToHtml` sanitize before TOC** — Sanitizer mangled headings. Reordered: strip → TOC → sanitize
- **[High] `parseArgs` rejects values starting with `-`** — Rejected `--header "-Section-"`. Changed to check `undefined` only
- **[Medium] Image serving `path.basename`** — Dropped subdirectory info. Changed to full relative path
- **[Medium] `/ui` route sync I/O** — `readFileSync` blocked event loop. Changed to `fs.promises.readFile`
- **[Medium] `startServer` unreliable `fs.watch`** — Platform-dependent. Changed to `fs.watchFile` (500ms)
- **[Medium] Merge mode sync I/O** — `readFileSync`/`writeFileSync` blocked. Changed to `fs.promises`
- **[Low] `startServer` sync I/O in `convertToHtml`** — Replaced with `fs.promises` equivalents
- **[Low] `startWatchMode` `fs.watch` unreliable** — Replaced with `fs.watchFile` polling
- **[Low] `startServer` TOCTOU `fs.watch`** — Could throw on deleted file. Wrapped in `try/catch`
- **[Low] `server.listen` EADDRINUSE** — No error listener. Added `server.on("error", ...)` with clean exit

**Web UI & CSS** (`web-ui.html`, `style-base.css`)

- **[High] Browser `import()` broken** — Core uses CommonJS. Changed to `fetch('/api/convert')` with server-mode notice
- **[Medium] `th` missing border** — Added `border: 1px solid var(--td-border)` to `th`
- **[Medium] `--text-muted` unused** — CSS variable declared but never referenced. Now used by `h6` and `.subtitle`
- **[Medium] No `/api/convert` endpoint** — Web UI called it but no handler existed. Added POST endpoint with 1MB limit
- **[Low] Missing viewport meta** — Broken on mobile. Added `<meta name="viewport">`
- **[Low] File input not reset** — Same file didn't trigger change. Added `fileInput.value = ''`
- **[Low] Missing Tabloid format** — Added `<option>Tabloid</option>` to dropdown

**NestJS & Types** (`lib/nestjs/`, `types/`)

- **[Medium] `convertFromContent` content override** — `{ content, ...options }` let `options.content` win. Changed to `{ ...options, content }`
- **[Low] `FrontmatterMeta` TypeScript incomplete** — Added 11 missing fields and `_explicitKeys`
- **[Low] `friendlyError` type too narrow** — Changed from `Error | { message: string }` to `unknown`
- **[Low] NestJS index.js wrong import path** — Comment showed `require('md2pdf-th/lib/nestjs')`. Fixed

**CI/CD** (`.github/workflows/ci.yml`)

- **[Medium] Single test step** — Split into separate unit and integration steps

### Added

- **44 regression tests** — 34 unit (`test/unit.test.js`), 8 NestJS module/service (`test/nestjs.test.js` — NEW), 2 integration (`test/md2pdf.test.js`)
- **`--lang <th|en>` CLI flag** — Language hint with validation, forwarded to core engine (`md2pdf.js`)
- **`--concurrency <n>` CLI flag** — Batch concurrency limit 1-32, default 4 (`md2pdf.js`)
- **`PdfMetadata` TypeScript interface** — Optional `Title`, `Author`, `Subject`, `Keywords`, `Creator` (`types/index.d.ts`)
- **`SECURITY.md`** — Vulnerability disclosure policy
- **`CONTRIBUTING.md`** — Contribution guidelines with branch strategy and PR checklist
- **`CODE_OF_CONDUCT.md`** — Contributor Covenant v2.1
- **`USAGE.md`** — Extended usage guide, environment variables, troubleshooting
- **`CODEBASE.md`** — Architecture overview, file tree, module responsibilities
- **`DEPLOY.md`** — Deployment guide (npm, Docker, CI/CD, NestJS)

### Changed

- `marked` pinned to `~15.0.0` (was `^15.0.0`) — prevent v16 breaking changes (`package.json`)
- **License MIT → Apache-2.0** — Updated `LICENSE`, `package.json`, `README.md`

### Improved

- **CSS architecture** — Extracted shared layout (84 lines) into `style-base.css`; theme files now contain only `:root` variables. Core composes base + theme at runtime
- **CSS caching** — `readCssCached()` with mtime-based invalidation; files read once, re-read only on disk change (`lib/md2pdf-core.js`)
- **CLI warnings** — File existence pre-check, `--merge` single file, `--watch` + `--merge` conflict, `--serve` multiple files (`md2pdf.js`)
- **Web UI** — h5/h6 heading styles, paragraph margin, MIME type validation for file drop, TOC checkbox row layout
- **Auth** — Server accepts Bearer token in Authorization header alongside query param (`md2pdf.js`)
- **JSDoc** — `@param`/`@returns` on all exported functions in `lib/md2pdf-core.js` (16 functions) and `lib/nestjs/md2pdf.service.js` (6 methods)

---

## [4.0.0] - 2026-04-30

### Breaking Changes — Async I/O & marked Export

- Core engine now uses **async file I/O** (`fs.promises`) — all `md2pdfTh()` calls remain async but internal reads are non-blocking (`lib/md2pdf-core.js`)
- `marked` is now exported from core — CLI imports it from core instead of a separate `require("marked")` (`lib/md2pdf-core.js`, `md2pdf.js`)

### Fixed — Auth & Performance (3 Critical + 3 Medium)

- **Auth token enforced** — Web server now requires `?token=<token>` query param; previously the token was generated but never validated (`md2pdf.js`)
- **Sync I/O to async** — `fs.readFileSync`/`writeFileSync`/`mkdirSync` replaced with `fs.promises` equivalents (`lib/md2pdf-core.js`)
- **marked import duplicate** — CLI now uses `marked` exported from core, removing a separate `require("marked")` (`md2pdf.js`)
- **Rate limit memory leak** — `ipRequests` Map now purges entries older than the window when size exceeds 1000 (`md2pdf.js`)
- **_parseFmValue regex hardening** — Key parameter escaped and whitelisted via `FM_KEYS` to prevent ReDoS (`lib/md2pdf-core.js`)
- **CSS 95% duplicate** — Both `style.css` and `style-dark.css` now use CSS custom properties (`--bg`, `--text`, etc.) for shared rules

### Added — Templates, Language Detection, Frontmatter & DevEx

- **Template system** — `--template resume|report|invoice` with built-in CSS templates in `templates/` directory
- **Auto-detect mixed language** — `detectThaiContent()` + `getFontStack()` inject Thai fonts automatically when Thai characters are detected, even with `lang: "en"`
- **Friendly error messages** — `friendlyError()` converts cryptic errors (Chrome not found, font missing, permission denied) into actionable advice
- **`--output-filename` pattern** — `--output-filename "{name}-{date}"` supports `{name}`, `{date}`, `{time}`, `{timestamp}`
- **Frontmatter options** — Set `theme:`, `toc:`, `cover:`, `format:`, `template:`, `watermark:`, `headerText:`, `footerText:`, `noPageNumbers:`, `font:`, `lang:` in YAML frontmatter
- **Dockerfile** — `docker build .` → `docker run md2pdf-th doc.md` with Chromium + Thai fonts pre-installed
- **GitHub Action** — `action.yml` for use as `uses: teeprakorn1/md2pdf-th` in CI pipelines
- **`--watermark`** — Diagonal semi-transparent watermark text via `pdf-lib`
- **Web UI** — `web-ui.html` standalone drag & drop .md → download PDF page
- **devDependencies** — Added `eslint` + `prettier`
- **New exports** — `addWatermark`, `detectThaiContent`, `getFontStack`, `resolveOutputFilename`, `friendlyError`, `marked`

---

## [3.2.0] - 2026-04-30

### Fixed — Rate Limiting, Frontmatter & UI (3 Critical + 6 Medium + 2 Low)

- **Rate limit reset** — Per-IP rate limit with 60s sliding window (resets automatically); was a global counter that never reset (`md2pdf.js`)
- **Rate limit per-IP** — Each IP tracked independently; one attacker can no longer block the server (`md2pdf.js`)
- **Web server auth** — Random auth token generated on start and displayed in console (`md2pdf.js`)
- **Frontmatter multi-line** — Supports YAML block scalar (`|`) and quoted values (`"..."`, `'...'`) (`lib/md2pdf-core.js`)
- **TOC id dedup** — Duplicate heading names get `-N` suffix (e.g. `intro`, `intro-1`) (`lib/md2pdf-core.js`)
- **noPageNumbers vs header** — `--no-page-numbers` hides page numbers only; custom `--header`/`--footer` still show (`lib/md2pdf-core.js`)
- **Cover+TOC insert** — Fixed `indexOf("</div>")` bug; now finds the cover-page closing tag specifically (`lib/md2pdf-core.js`)
- **Watch debounce** — Proper `setTimeout`/`clearTimeout` debounce instead of manual timestamp check (`md2pdf.js`)
- **Serve images** — Web server now serves image files (png, jpg, gif, svg, webp, ico) from the markdown file's directory (`md2pdf.js`)
- **escapeHtml** — Added `/` → `&#x2F;` per OWASP recommendation (`lib/md2pdf-core.js`)
- **CSS variables** — Both `style.css` and `style-dark.css` now use CSS custom properties for shared rules

### Added

- **3 new unit tests** — frontmatter quoted values, block scalar, TOC dedup (`test/unit.test.js`)

---

## [3.1.0] - 2026-04-30

### Fixed — NestJS, Security & Parsing (3 Critical + 3 Medium + 3 Low)

- **NestJS Module** — Rewrote with proper DI pattern; `Md2PdfModule.forRoot()` / `forRootAsync()` now correctly registers `Md2PdfService` with `global: true` (`lib/nestjs/md2pdf.module.js`)
- **_defaults merge** — `Md2PdfService` now merges defaults from `forRoot()` into all method calls (`convert`, `convertFromContent`, `convertFromFile`, `convertToFile`) (`lib/nestjs/md2pdf.service.js`)
- **Web server security** — Added rate limiting (100 req/session), bind to `127.0.0.1` only, 404 for unknown paths (`md2pdf.js`)
- **Duplicate marked import** — CLI now imports `marked` locally in `startServer()` only; core functions imported from engine (`md2pdf.js`)
- **addPdfMetadata error logging** — Changed from silent catch to `console.warn()` with the error message (`lib/md2pdf-core.js`)
- **CI release action** — Replaced deprecated `actions/create-release@v1` with `softprops/action-gh-release@v2`
- **parseFrontmatter** — Now supports `title:`, `tags:`, `description:` in addition to `author:` and `date:` (`lib/md2pdf-core.js`)
- **VERSION hardcoded** — Now reads from `package.json` via `require("../package.json").version` (`lib/md2pdf-core.js`)
- **eslint placeholder** — Removed no-op echo script (`package.json`)
- **Cover page uses frontmatter.title** — If `title:` is in frontmatter, it is used for the cover instead of the h1 (`lib/md2pdf-core.js`)

### Added

- **TypeScript types** — `types/index.d.ts` + `types/nestjs.d.ts` with full type definitions
- **Unit tests** — `test/unit.test.js` with 21 tests for core functions (sanitize, escape, title, frontmatter, TOC, cover); no Puppeteer required
- **Test scripts** — `npm run test:unit` and `npm run test:integration` for targeted runs (`package.json`)

---

## [3.0.0] - 2026-04-30

### Changed — Architecture Refactor

- **Architecture refactor** — Separated core engine (`lib/md2pdf-core.js`) from CLI (`md2pdf.js`)
- **Library API** — `md2pdfTh()` function returns `Buffer`; usable from any Node.js code
- **NestJS module** — `Md2PdfModule` + `Md2PdfService` for dependency injection
- **package.json exports** — `require('md2pdf-th')` → core engine, `require('md2pdf-th/nestjs')` → NestJS

### Added — Dark Theme, TOC, Cover, Merge, Watch, Web Server

- `--theme dark` / `theme: 'dark'` — Dark mode PDF with `style-dark.css`
- `--toc` / `toc: true` — Auto-generated Table of Contents from headings
- `--cover` / `cover: true` — Cover page from YAML frontmatter
- `--merge` / `mergePdfBuffers()` — Merge multiple PDFs into one
- `--watch` — Watch mode; auto-reconvert on file change
- `--serve` / `--port` — Live HTML preview web server
- `--header` / `--footer` — Custom header/footer text
- `--format` — Page sizes: A3, A4, A5, Letter, Legal, Tabloid
- `--font` — Custom font family injection
- PDF metadata via `pdf-lib` (Title, Author, Subject, Keywords, Creator)
- Enhanced HTML sanitization (SVG, math, style, details, javascript:, vbscript:)
- Path traversal validation for `--css`, `--outdir`, input files
- `--no-sandbox` only in CI environment (`process.env.CI`)

### Security

- Cover page XSS fix — `escapeHtml()` applied to title, author, date
- Expanded `sanitizeHtml()` — strips `<svg>`, `<math>`, `<style>`, `<details>`, `javascript:`, `vbscript:`, `data:text/html`
- Web server binds to `127.0.0.1` only with auth warning

---

## [2.0.0] - 2026-04-30

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

---

## [1.0.1] - 2026-04-30

### Fixed

- `bin` entry in `package.json` corrected for `npx` compatibility
- CI workflow: removed `cache: npm`, changed `npm ci` to `npm install`
- Added `.npmrc` to `.gitignore` to prevent token leaks

---

## [1.0.0] - 2026-04-30

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

