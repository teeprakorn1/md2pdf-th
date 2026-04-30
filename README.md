# md2pdf-th

> CLI tool to convert Markdown files to PDF — Thai/English support, page numbers, custom CSS, batch conversion

[![npm version](https://img.shields.io/npm/v/md2pdf-th.svg)](https://www.npmjs.com/package/md2pdf-th)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- 🇹🇭 **Thai language support** — Leelawadee + system font fallback
- 📄 **Page numbers** — Header title + page X/Y footer
- 🎨 **Custom CSS** — Override default styling with `--css`
- 📦 **Batch conversion** — Convert multiple files at once
- 📁 **Output directory** — `--outdir` for custom output location
- 🧹 **Emoji stripping** — Clean titles in PDF headers
- 🖨️ **A4 format** — Optimized table layout, page break control

## Quick Start

### Using npx (no install)

```bash
npx md2pdf-th document.md
```

### Global install

```bash
npm install -g md2pdf-th
md2pdf document.md
```

### Windows (.bat)

```bat
md2pdf.bat document.md
```

## Usage

```bash
md2pdf <file.md> [output.pdf]
md2pdf <file1.md> <file2.md> ...          # batch convert
md2pdf [options] <file.md>
```

### Options

| Option | Description |
|--------|-------------|
| `--css <path>` | Custom CSS file path |
| `--outdir, -o <dir>` | Output directory (default: same as input) |
| `--no-page-numbers` | Disable page numbers and header |
| `--version, -v` | Show version |
| `--help, -h` | Show help |

### Examples

```bash
# Single file
md2pdf doc.md

# Single file with custom output name
md2pdf doc.md output.pdf

# Batch convert
md2pdf doc1.md doc2.md doc3.md

# Custom CSS
md2pdf --css dark-theme.css doc.md

# Output to specific directory
md2pdf -o ./pdfs *.md

# No page numbers
md2pdf --no-page-numbers doc.md

# Convert from md/ folder
md2pdf md/sample.md
md2pdf -o ./pdfs md/*.md
```

## Custom CSS

Default stylesheet (`style.css`) is bundled with the package. To override:

```bash
md2pdf --css my-style.css doc.md
```

The default CSS includes:
- Thai font stack (Leelawadee, Tahoma, Segoe UI, Noto Sans Thai)
- Fixed table layout with word-break for long content
- Page break control (headings stay with content)
- Code blocks with dark theme
- Emoji font fallback (Segoe UI Emoji, Apple Color Emoji)

## How It Works

1. Reads the Markdown file and extracts the first `# heading` as document title
2. Strips emojis and markdown formatting from the title
3. Renders HTML via `md-to-pdf` (Puppeteer/headless Chrome)
4. Applies CSS styling with page break optimization
5. Outputs A4 PDF with header (title) and footer (page numbers)

## Requirements

- Node.js >= 16.0.0
- Chromium (auto-installed by Puppeteer via `md-to-pdf`)

## License

MIT © Teepakorn Kumvong
