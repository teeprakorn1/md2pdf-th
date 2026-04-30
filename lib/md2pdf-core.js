/**
 * md2pdf-th Core Engine
 * Convert Markdown to PDF — usable as library or CLI
 */

const fs = require("fs");
const path = require("path");
const { mdToPdf } = require("md-to-pdf");
const { PDFDocument } = require("pdf-lib");
const { marked } = require("marked");

const VERSION = "3.0.0";
const DEFAULT_CSS_PATH = path.join(__dirname, "..", "style.css");
const DARK_CSS_PATH = path.join(__dirname, "..", "style-dark.css");
const PAGE_SIZES = ["A3", "A4", "A5", "Letter", "Legal", "Tabloid"];
const PAGE_HEADER_TEMPLATE = `<div style="font-size:8px;width:100%;text-align:center;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%"><span class="title"></span></div>`;
const PAGE_FOOTER_TEMPLATE = `<div style="font-size:9px;width:100%;text-align:center;color:#94a3b8"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`;

// ─── Sanitize ────────────────────────────────────────────────────────────────

function sanitizeHtml(content) {
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^>]*>[^<]*<\/embed>/gi, "").replace(/<embed\b[^>]*>/gi, "")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "")
    .replace(/<math\b[^>]*>[\s\S]*?<\/math>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<details\b[^>]*>[\s\S]*?<\/details>/gi, "")
    .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, "").replace(/\s+on\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\s+on\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript\s*:/gi, "").replace(/vbscript\s*:/gi, "")
    .replace(/data\s*:\s*text\/html/gi, "");
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

// ─── Title ───────────────────────────────────────────────────────────────────

function extractTitleFromContent(content, maxLen = 0, fallback) {
  const match = content.match(/^#\s+(.+)$/m);
  let title = match ? match[1].replace(/[*_`~]/g,"").replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu,"").replace(/\s+/g," ").trim() : fallback;
  if (maxLen > 0 && title.length > maxLen) title = title.slice(0, maxLen - 1) + "…";
  return title;
}

// ─── Frontmatter ─────────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const meta = { author: "", date: "", rawLength: 0 };
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (match) {
    const fm = match[1];
    const a = fm.match(/^author:\s*(.+)$/m); if (a) meta.author = a[1].trim();
    const d = fm.match(/^date:\s*(.+)$/m); if (d) meta.date = d[1].trim();
    meta.rawLength = match[0].length;
  }
  return meta;
}

function stripFrontmatter(content) { return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, ""); }

// ─── TOC ─────────────────────────────────────────────────────────────────────

function generateToc(content) {
  const headings = [];
  for (const line of content.split("\n")) {
    const m = line.match(/^(#{1,3})\s+(.+)$/);
    if (m) { const text = m[2].replace(/[*_`~]/g,"").trim(); const id = text.toLowerCase().replace(/[^\w\u0E00-\u0E7F]+/g,"-").replace(/^-|-$/g,""); headings.push({ level: m[1].length, text, id }); }
  }
  if (!headings.length) return "";
  let toc = "\n---\n\n## สารบัญ / Table of Contents\n\n";
  for (const h of headings) { const indent = h.level === 1 ? "" : h.level === 2 ? "  " : "    "; toc += `${indent}- [${h.text}](#${h.id})\n`; }
  return toc + "\n---\n\n";
}

// ─── Cover Page ──────────────────────────────────────────────────────────────

function generateCoverPage(title, author, date) {
  let cover = `<div class="cover-page">\n\n# ${escapeHtml(title)}\n\n`;
  if (author) cover += `<div class="cover-author">${escapeHtml(author)}</div>\n\n`;
  cover += `<div class="cover-date">${escapeHtml(date)}</div>\n\n</div>\n\n`;
  return cover;
}

// ─── PDF Metadata (pdf-lib) ──────────────────────────────────────────────────

async function addPdfMetadata(pdfBytes, metadata) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  pdfDoc.setTitle(metadata.Title || "");
  pdfDoc.setAuthor(metadata.Author || "");
  pdfDoc.setSubject(metadata.Subject || "");
  pdfDoc.setKeywords(metadata.Keywords ? metadata.Keywords.split(", ").map(k => k.trim()) : []);
  pdfDoc.setCreator(metadata.Creator || "");
  pdfDoc.setProducer("md2pdf-th");
  pdfDoc.setCreationDate(new Date());
  return await pdfDoc.save();
}

// ─── PDF Merge ───────────────────────────────────────────────────────────────

async function mergePdfBuffers(pdfBuffers) {
  const mergedPdf = await PDFDocument.create();
  for (const buf of pdfBuffers) {
    const doc = await PDFDocument.load(buf);
    const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
    for (const page of pages) mergedPdf.addPage(page);
  }
  return await mergedPdf.save();
}

// ─── Core API: md2pdfTh() ───────────────────────────────────────────────────

/**
 * Convert Markdown to PDF
 * @param {object} options
 * @param {string} [options.content] - Markdown content string
 * @param {string} [options.inputPath] - Path to .md file (alternative to content)
 * @param {string} [options.outputPath] - Output PDF file path (if omitted, returns Buffer)
 * @param {string} [options.css] - Custom CSS string
 * @param {string} [options.cssPath] - Path to custom CSS file
 * @param {'light'|'dark'} [options.theme='light'] - Color theme
 * @param {boolean} [options.toc=false] - Generate Table of Contents
 * @param {boolean} [options.cover=false] - Add cover page
 * @param {string} [options.headerText] - Custom header text
 * @param {string} [options.footerText] - Custom footer text
 * @param {string} [options.format='A4'] - Page size
 * @param {string} [options.font] - Custom font family
 * @param {boolean} [options.noPageNumbers=false] - Disable page numbers
 * @param {'th'|'en'} [options.lang='th'] - Language hint for font selection
 * @returns {Promise<Buffer>} PDF buffer
 */
async function md2pdfTh(options = {}) {
  const {
    content, inputPath, outputPath, css: customCss, cssPath,
    theme = "light", toc = false, cover = false,
    headerText, footerText, format = "A4", font,
    noPageNumbers = false, lang = "th",
  } = options;

  // 1. Read markdown
  let mdContent;
  if (content) {
    mdContent = content;
  } else if (inputPath) {
    const resolved = path.resolve(inputPath);
    if (!fs.existsSync(resolved)) throw new Error(`File not found: ${inputPath}`);
    mdContent = fs.readFileSync(resolved, "utf-8");
  } else {
    throw new Error("Either 'content' or 'inputPath' is required");
  }

  // 2. Parse frontmatter, strip, sanitize
  const frontmatter = parseFrontmatter(mdContent);
  const baseName = inputPath ? path.basename(inputPath, ".md") : "Untitled";
  const title = extractTitleFromContent(mdContent, 0, baseName);
  const headerTitle = extractTitleFromContent(mdContent, 60, baseName);

  let finalContent = sanitizeHtml(stripFrontmatter(mdContent));

  // 3. Cover page
  if (cover) {
    const coverDate = frontmatter.date || new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
    finalContent = generateCoverPage(title, frontmatter.author, coverDate) + finalContent;
  }

  // 4. TOC
  if (toc) {
    const tocContent = generateToc(finalContent);
    if (cover) { const coverEnd = finalContent.indexOf("</div>") + 6; finalContent = finalContent.slice(0, coverEnd) + "\n\n" + tocContent + finalContent.slice(coverEnd); }
    else { finalContent = tocContent + finalContent; }
  }

  // 5. CSS — theme or custom
  let css;
  if (customCss) {
    css = customCss;
  } else if (cssPath) {
    css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf-8") : "";
  } else {
    const cssFile = theme === "dark" ? DARK_CSS_PATH : DEFAULT_CSS_PATH;
    css = fs.existsSync(cssFile) ? fs.readFileSync(cssFile, "utf-8") : "";
  }

  // Auto Thai font injection
  if (font) {
    css = `body { font-family: '${font}', 'Noto Sans Thai', 'Segoe UI Emoji', sans-serif !important; }\n` + css;
  } else if (lang === "th") {
    css = `body { font-family: 'Leelawadee', 'Tahoma', 'Noto Sans Thai', 'Segoe UI Emoji', sans-serif !important; }\n` + css;
  }

  // 6. Header/Footer templates
  const headerTemplate = noPageNumbers ? "" : headerText ? `<div style="font-size:8px;width:100%;text-align:center;color:#94a3b8">${escapeHtml(headerText)}</div>` : PAGE_HEADER_TEMPLATE;
  const footerTemplate = noPageNumbers ? "" : footerText ? `<div style="font-size:9px;width:100%;text-align:center;color:#94a3b8">${escapeHtml(footerText)}</div>` : PAGE_FOOTER_TEMPLATE;
  const marginConfig = noPageNumbers ? { top:"20mm",bottom:"20mm",left:"15mm",right:"15mm" } : { top:"25mm",bottom:"25mm",left:"15mm",right:"15mm" };

  // 7. Puppeteer — only --no-sandbox in CI
  const launchArgs = ["--font-render-hinting=medium"];
  if (process.env.CI) launchArgs.push("--no-sandbox", "--disable-setuid-sandbox");

  // 8. Convert
  const pdf = await mdToPdf({ content: finalContent }, {
    css,
    document_title: headerTitle,
    launch_options: { args: launchArgs },
    pdf_options: { format: format || "A4", margin: marginConfig, printBackground: true, displayHeaderFooter: !noPageNumbers, headerTemplate, footerTemplate, preferCSSPageSize: false },
    body: `<script>document.title = ${JSON.stringify(headerTitle)};</script>`,
  });

  if (!pdf) throw new Error("PDF generation failed");

  // 9. Add metadata via pdf-lib
  let pdfBuffer = Buffer.from(pdf.content);
  try {
    const modifiedBytes = await addPdfMetadata(pdfBuffer, {
      Title: headerTitle, Author: "md2pdf-th",
      Subject: "Markdown document converted to PDF",
      Keywords: "markdown, pdf", Creator: `md2pdf-th v${VERSION}`,
    });
    pdfBuffer = Buffer.from(modifiedBytes);
  } catch (_) { /* metadata is non-critical */ }

  // 10. Write to file or return Buffer
  if (outputPath) {
    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outputPath, pdfBuffer);
  }

  return pdfBuffer;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  md2pdfTh,
  mergePdfBuffers,
  sanitizeHtml,
  escapeHtml,
  extractTitleFromContent,
  generateToc,
  generateCoverPage,
  parseFrontmatter,
  stripFrontmatter,
  addPdfMetadata,
  VERSION,
  PAGE_SIZES,
};
