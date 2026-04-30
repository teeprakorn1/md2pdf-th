/**
 * md2pdf-th Core Engine v4
 * Convert Markdown to PDF — usable as library or CLI
 */

const fs = require("fs");
const path = require("path");
const { mdToPdf } = require("md-to-pdf");
const { PDFDocument, rgb, degrees } = require("pdf-lib");
const { marked } = require("marked");

const VERSION = require("../package.json").version;
const DEFAULT_CSS_PATH = path.join(__dirname, "..", "style.css");
const DARK_CSS_PATH = path.join(__dirname, "..", "style-dark.css");
const TEMPLATE_DIR = path.join(__dirname, "..", "templates");
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
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/\//g,"&#x2F;");
}

// ─── Language Detection ──────────────────────────────────────────────────────

function detectThaiContent(content) {
  const thaiChars = (content.match(/[\u0E00-\u0E7F]/g) || []).length;
  const totalChars = content.replace(/\s/g, "").length || 1;
  return thaiChars / totalChars;
}

function getFontStack(lang, content, customFont) {
  const thaiRatio = detectThaiContent(content);
  const hasThai = thaiRatio > 0.01;
  if (customFont) {
    const base = hasThai ? `'${customFont}', 'Noto Sans Thai', 'Leelawadee', 'Tahoma'` : `'${customFont}'`;
    return `${base}, 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif`;
  }
  if (lang === "en" && !hasThai) {
    return "'Segoe UI', 'Helvetica Neue', 'Arial', 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
  }
  // Thai or mixed — always include Thai fonts
  return "'Leelawadee', 'Tahoma', 'Noto Sans Thai', 'Segoe UI', 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
}

// ─── Title ───────────────────────────────────────────────────────────────────

function extractTitleFromContent(content, maxLen = 0, fallback) {
  const match = content.match(/^#\s+(.+)$/m);
  let title = match ? match[1].replace(/[*_`~]/g,"").replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu,"").replace(/\s+/g," ").trim() : fallback;
  if (maxLen > 0 && title.length > maxLen) title = title.slice(0, maxLen - 1) + "…";
  return title;
}

// ─── Frontmatter ─────────────────────────────────────────────────────────────

const FM_KEYS = ["title","author","date","tags","description","theme","toc","cover","format","headerText","footerText","noPageNumbers","font","lang","template","watermark"];

function _parseFmValue(fm, key) {
  if (!FM_KEYS.includes(key)) return "";
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Try YAML block scalar: key: | \n  value
  const blockRe = new RegExp(`^${escapedKey}:\\s*\\|\\s*\\n([\\s\\S]*?)(?=\\n[^ \\n]|\\n$|$)`, "m");
  const blockMatch = fm.match(blockRe);
  if (blockMatch) return blockMatch[1].replace(/^\s+/gm, "").trim();
  // Try quoted: key: "value" or key: 'value'
  const quotedRe = new RegExp(`^${escapedKey}:\\s*["'](.+?)["']\\s*$`, "m");
  const quotedMatch = fm.match(quotedRe);
  if (quotedMatch) return quotedMatch[1].trim();
  // Try simple: key: value
  const simpleRe = new RegExp(`^${escapedKey}:\\s*(.+)$`, "m");
  const simpleMatch = fm.match(simpleRe);
  if (simpleMatch) return simpleMatch[1].trim().replace(/['"]/g, "");
  return "";
}

function parseFrontmatter(content) {
  const meta = { title: "", author: "", date: "", tags: [], description: "", rawLength: 0,
    theme: "", toc: false, cover: false, format: "", headerText: "", footerText: "",
    noPageNumbers: false, font: "", lang: "", template: "", watermark: "" };
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (match) {
    const fm = match[1];
    meta.title = _parseFmValue(fm, "title");
    meta.author = _parseFmValue(fm, "author");
    meta.date = _parseFmValue(fm, "date");
    meta.description = _parseFmValue(fm, "description");
    const tg = _parseFmValue(fm, "tags");
    if (tg) meta.tags = tg.split(",").map(s => s.trim());
    // Options from frontmatter
    const theme = _parseFmValue(fm, "theme");
    if (theme) meta.theme = theme;
    const toc = _parseFmValue(fm, "toc");
    if (toc === "true") meta.toc = true;
    const cover = _parseFmValue(fm, "cover");
    if (cover === "true") meta.cover = true;
    const format = _parseFmValue(fm, "format");
    if (format) meta.format = format;
    const headerText = _parseFmValue(fm, "headerText");
    if (headerText) meta.headerText = headerText;
    const footerText = _parseFmValue(fm, "footerText");
    if (footerText) meta.footerText = footerText;
    const noPageNumbers = _parseFmValue(fm, "noPageNumbers");
    if (noPageNumbers === "true") meta.noPageNumbers = true;
    const font = _parseFmValue(fm, "font");
    if (font) meta.font = font;
    const lang = _parseFmValue(fm, "lang");
    if (lang) meta.lang = lang;
    const template = _parseFmValue(fm, "template");
    if (template) meta.template = template;
    const watermark = _parseFmValue(fm, "watermark");
    if (watermark) meta.watermark = watermark;
    meta.rawLength = match[0].length;
  }
  return meta;
}

function stripFrontmatter(content) { return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, ""); }

// ─── TOC ─────────────────────────────────────────────────────────────────────

function generateToc(content) {
  const headings = [];
  const idCounts = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^(#{1,3})\s+(.+)$/);
    if (m) {
      const text = m[2].replace(/[*_`~]/g,"").trim();
      let id = text.toLowerCase().replace(/[^\w\u0E00-\u0E7F]+/g,"-").replace(/^-|-$/g,"");
      if (idCounts[id] !== undefined) { idCounts[id]++; id = `${id}-${idCounts[id]}`; } else { idCounts[id] = 0; }
      headings.push({ level: m[1].length, text, id });
    }
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

// ─── Watermark ───────────────────────────────────────────────────────────────

async function addWatermark(pdfBytes, text) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont("Helvetica");
  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();
    page.drawText(text, {
      x: width / 2 - font.widthOfTextAtSize(text, 40) / 2,
      y: height / 2,
      size: 40,
      font,
      color: rgb(0.7, 0.7, 0.7),
      opacity: 0.3,
      rotate: degrees(-45),
    });
  }
  return await pdfDoc.save();
}

// ─── Output Filename Pattern ─────────────────────────────────────────────────

function resolveOutputFilename(pattern, baseName) {
  const now = new Date();
  return pattern
    .replace(/\{name\}/g, baseName)
    .replace(/\{date\}/g, now.toISOString().slice(0, 10))
    .replace(/\{time\}/g, now.toTimeString().slice(0, 8).replace(/:/g, "-"))
    .replace(/\{timestamp\}/g, now.getTime().toString());
}

// ─── Friendly Errors ─────────────────────────────────────────────────────────

function friendlyError(err) {
  const msg = err.message || String(err);
  if (msg.includes("Protocol error") && msg.includes("printToPDF")) {
    return "PDF generation failed — Chrome/Puppeteer error. Make sure Chromium is installed and --no-sandbox is set in CI environments. Try: set CI=true or run with --no-sandbox flag.";
  }
  if (msg.includes("Could not find Chrome") || msg.includes("Could not establish connection")) {
    return "Chrome/Chromium not found. Install it with: npm install puppeteer (or set PUPPETEER_EXECUTABLE_PATH). On Linux CI: sudo apt install chromium-browser.";
  }
  if (msg.includes("net::ERR_FILE_NOT_FOUND") || msg.includes("Failed to load resource")) {
    return "Font or resource not found. For Thai fonts, install 'Leelawadee' or 'Noto Sans Thai' on your system. On Linux: sudo apt install fonts-noto-cjk fonts-noto.";
  }
  if (msg.includes("ENOENT")) {
    return `File not found: ${msg}. Check that the input path is correct.`;
  }
  if (msg.includes("EACCES")) {
    return `Permission denied: ${msg}. Check file/directory permissions.`;
  }
  return msg;
}

// ─── Core API: md2pdfTh() ───────────────────────────────────────────────────

/**
 * Convert Markdown to PDF
 * @param {object} options
 * @param {string} [options.content] - Markdown content string
 * @param {string} [options.inputPath] - Path to .md file
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
 * @param {'th'|'en'} [options.lang='th'] - Language hint
 * @param {string} [options.template] - Built-in template name (resume, report, invoice)
 * @param {string} [options.watermark] - Watermark text
 * @param {string} [options.outputFilename] - Output filename pattern ({name}, {date}, {timestamp})
 * @returns {Promise<Buffer>} PDF buffer
 */
async function md2pdfTh(options = {}) {
  const {
    content, inputPath, outputPath, css: customCss, cssPath,
    theme = "light", toc = false, cover = false,
    headerText, footerText, format = "A4", font,
    noPageNumbers = false, lang = "th",
    template, watermark, outputFilename,
  } = options;

  // 1. Read markdown (async)
  let mdContent;
  if (content) {
    mdContent = content;
  } else if (inputPath) {
    const resolved = path.resolve(inputPath);
    try {
      mdContent = await fs.promises.readFile(resolved, "utf-8");
    } catch (err) {
      throw new Error(`File not found: ${inputPath} — ${err.message}`);
    }
  } else {
    throw new Error("Either 'content' or 'inputPath' is required");
  }

  // 2. Parse frontmatter, strip, sanitize
  const frontmatter = parseFrontmatter(mdContent);
  const baseName = inputPath ? path.basename(inputPath, ".md") : "Untitled";
  const title = frontmatter.title || extractTitleFromContent(mdContent, 0, baseName);
  const headerTitle = extractTitleFromContent(mdContent, 60, baseName);

  // Merge frontmatter options (frontmatter overrides defaults, but explicit CLI flags override frontmatter)
  const fmTheme = frontmatter.theme || theme;
  const fmToc = frontmatter.toc || toc;
  const fmCover = frontmatter.cover || cover;
  const fmFormat = frontmatter.format || format;
  const fmHeaderText = frontmatter.headerText || headerText;
  const fmFooterText = frontmatter.footerText || footerText;
  const fmNoPageNumbers = frontmatter.noPageNumbers || noPageNumbers;
  const fmFont = frontmatter.font || font;
  const fmLang = frontmatter.lang || lang;
  const fmTemplate = frontmatter.template || template;
  const fmWatermark = frontmatter.watermark || watermark;

  let finalContent = sanitizeHtml(stripFrontmatter(mdContent));

  // 3. Cover page
  if (fmCover) {
    const coverTitle = frontmatter.title || title;
    const coverDate = frontmatter.date || new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
    finalContent = generateCoverPage(coverTitle, frontmatter.author, coverDate) + finalContent;
  }

  // 4. TOC
  if (fmToc) {
    const tocContent = generateToc(finalContent);
    if (fmCover) {
      const coverEndMarker = '<div class="cover-date">';
      const coverDateIdx = finalContent.indexOf(coverEndMarker);
      if (coverDateIdx !== -1) {
        const afterDate = finalContent.indexOf("</div>", coverDateIdx);
        const afterOuter = finalContent.indexOf("</div>", afterDate + 6);
        const insertAt = (afterOuter !== -1 ? afterOuter : afterDate) + 6;
        finalContent = finalContent.slice(0, insertAt) + "\n\n" + tocContent + finalContent.slice(insertAt);
      } else {
        finalContent = tocContent + finalContent;
      }
    }
    else { finalContent = tocContent + finalContent; }
  }

  // 5. CSS — template, theme, or custom
  let css;
  if (fmTemplate) {
    const templatePath = path.join(TEMPLATE_DIR, `${fmTemplate}.css`);
    if (fs.existsSync(templatePath)) {
      css = await fs.promises.readFile(templatePath, "utf-8");
    } else {
      console.warn(`  Warning: Template '${fmTemplate}' not found at ${templatePath}, falling back to theme CSS`);
      const cssFile = fmTheme === "dark" ? DARK_CSS_PATH : DEFAULT_CSS_PATH;
      css = fs.existsSync(cssFile) ? await fs.promises.readFile(cssFile, "utf-8") : "";
    }
  } else if (customCss) {
    css = customCss;
  } else if (cssPath) {
    css = fs.existsSync(cssPath) ? await fs.promises.readFile(cssPath, "utf-8") : "";
  } else {
    const cssFile = fmTheme === "dark" ? DARK_CSS_PATH : DEFAULT_CSS_PATH;
    css = fs.existsSync(cssFile) ? await fs.promises.readFile(cssFile, "utf-8") : "";
  }

  // Auto font injection based on content detection
  const fontStack = getFontStack(fmLang, mdContent, fmFont);
  css = `body { font-family: ${fontStack} !important; }\n` + css;

  // 6. Header/Footer templates
  const showHeader = !fmNoPageNumbers || fmHeaderText;
  const showFooter = !fmNoPageNumbers || fmFooterText;
  const headerTemplate = showHeader ? (fmHeaderText ? `<div style="font-size:8px;width:100%;text-align:center;color:#94a3b8">${escapeHtml(fmHeaderText)}</div>` : PAGE_HEADER_TEMPLATE) : "";
  const footerTemplate = showFooter ? (fmFooterText ? `<div style="font-size:9px;width:100%;text-align:center;color:#94a3b8">${escapeHtml(fmFooterText)}</div>` : PAGE_FOOTER_TEMPLATE) : "";
  const displayHeaderFooter = !!(showHeader || showFooter);
  const marginConfig = displayHeaderFooter ? { top:"25mm",bottom:"25mm",left:"15mm",right:"15mm" } : { top:"20mm",bottom:"20mm",left:"15mm",right:"15mm" };

  // 7. Puppeteer
  const launchArgs = ["--font-render-hinting=medium"];
  if (process.env.CI) launchArgs.push("--no-sandbox", "--disable-setuid-sandbox");

  // 8. Convert
  let pdf;
  try {
    pdf = await mdToPdf({ content: finalContent }, {
      css,
      document_title: headerTitle,
      launch_options: { args: launchArgs },
      pdf_options: { format: fmFormat || "A4", margin: marginConfig, printBackground: true, displayHeaderFooter, headerTemplate, footerTemplate, preferCSSPageSize: false },
      body: `<script>document.title = ${JSON.stringify(headerTitle)};</script>`,
    });
  } catch (err) {
    throw new Error(friendlyError(err));
  }

  if (!pdf) throw new Error("PDF generation failed — no output from md-to-pdf. Ensure Chromium is installed.");

  // 9. Add metadata via pdf-lib
  let pdfBuffer = Buffer.from(pdf.content);
  try {
    const modifiedBytes = await addPdfMetadata(pdfBuffer, {
      Title: headerTitle, Author: "md2pdf-th",
      Subject: "Markdown document converted to PDF",
      Keywords: "markdown, pdf", Creator: `md2pdf-th v${VERSION}`,
    });
    pdfBuffer = Buffer.from(modifiedBytes);
  } catch (metaErr) { console.warn(`  Warning: PDF metadata injection failed: ${metaErr.message}`); }

  // 10. Watermark
  if (fmWatermark) {
    try {
      const watermarked = await addWatermark(pdfBuffer, fmWatermark);
      pdfBuffer = Buffer.from(watermarked);
    } catch (wmErr) { console.warn(`  Warning: Watermark failed: ${wmErr.message}`); }
  }

  // 11. Write to file or return Buffer
  if (outputPath) {
    const finalOutputPath = outputFilename
      ? path.join(path.dirname(outputPath), resolveOutputFilename(outputFilename, baseName) + ".pdf")
      : outputPath;
    const outDir = path.dirname(finalOutputPath);
    if (!fs.existsSync(outDir)) await fs.promises.mkdir(outDir, { recursive: true });
    await fs.promises.writeFile(finalOutputPath, pdfBuffer);
  }

  return pdfBuffer;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  md2pdfTh,
  mergePdfBuffers,
  addWatermark,
  sanitizeHtml,
  escapeHtml,
  extractTitleFromContent,
  generateToc,
  generateCoverPage,
  parseFrontmatter,
  stripFrontmatter,
  addPdfMetadata,
  detectThaiContent,
  getFontStack,
  resolveOutputFilename,
  friendlyError,
  marked,
  VERSION,
  PAGE_SIZES,
};
