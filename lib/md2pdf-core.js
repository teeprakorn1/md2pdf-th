/**
 * md2pdf-th Core Engine v4
 * Convert Markdown to PDF — usable as library or CLI
 */

const fs = require("fs");
const path = require("path");
const { mdToPdf } = require("md-to-pdf");
const { PDFDocument, rgb, degrees, StandardFonts } = require("pdf-lib");
const { marked } = require("marked");

const VERSION = require("../package.json").version;
const DEFAULT_CSS_PATH = path.join(__dirname, "..", "style.css");
const DARK_CSS_PATH = path.join(__dirname, "..", "style-dark.css");
const BASE_CSS_PATH = path.join(__dirname, "..", "style-base.css");
const TEMPLATE_DIR = path.join(__dirname, "..", "templates");
const PAGE_SIZES = ["A3", "A4", "A5", "Letter", "Legal", "Tabloid"];
const _cssCache = new Map();

/**
 * Read CSS file with caching
 * @param {string} filePath - Path to CSS file
 * @returns {Promise<string>} CSS content
 */
async function readCssCached(filePath) {
  try {
    const stat = await fs.promises.stat(filePath);
    const cached = _cssCache.get(filePath);
    if (cached && cached.mtime >= stat.mtimeMs) return cached.content;
    const content = await fs.promises.readFile(filePath, "utf-8");
    _cssCache.set(filePath, { content, mtime: stat.mtimeMs });
    return content;
  } catch { return ""; }
}

const PAGE_HEADER_TEMPLATE = `<div style="font-size:8px;width:100%;text-align:center;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%"><span class="title"></span></div>`;
const PAGE_FOOTER_TEMPLATE = `<div style="font-size:9px;width:100%;text-align:center;color:#94a3b8"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`;

/**
 * Sanitize HTML content by removing potentially dangerous tags and attributes
 * @param {string} content - HTML content to sanitize
 * @returns {string} Sanitized HTML content
 */
function sanitizeHtml(content) {
  return content
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*>/gi, "")
    .replace(/<\/script>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<iframe\b[^>]*>/gi, "")
    .replace(/<object\b[\s\S]*?<\/object>/gi, "")
    .replace(/<object\b[^>]*>/gi, "")
    .replace(/<embed\b[^>]*>[\s\S]*?<\/embed>/gi, "").replace(/<embed\b[^>]*>/gi, "")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, "")
    .replace(/<svg\b[^>]*>/gi, "")
    .replace(/<math\b[\s\S]*?<\/math>/gi, "")
    .replace(/<math\b[^>]*>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<style\b[^>]*>/gi, "")
    .replace(/<details\b[\s\S]*?<\/details>/gi, "")
    .replace(/<form\b[\s\S]*?<\/form>/gi, "")
    .replace(/<form\b[^>]*>/gi, "")
    .replace(/<base\b[^>]*\/?>/gi, "")
    .replace(/<link\b[^>]*\/?>/gi, "")
    .replace(/<meta\b[^>]*\/?>/gi, "")
    .replace(/(<[^>]*?)\s+on\w+\s*=\s*"[^"]*"/gi, "$1").replace(/(<[^>]*?)\s+on\w+\s*=\s*'[^']*'/gi, "$1")
    .replace(/(<[^>]*?)\s+on\w+\s*=\s*`[^`]*`/gi, "$1")
    .replace(/(<[^>]*?)\s+on\w+\s*=\s*[^\s>]+/gi, "$1")
    .replace(/javascript\s*:/gi, "").replace(/vbscript\s*:/gi, "")
    .replace(/data\s*:\s*(?:text\/html|image\/svg\+xml|application\/x?html)/gi, "");
}

/**
 * Escape HTML entities
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/\//g,"&#x2F;");
}

/**
 * Detect Thai content ratio
 * @param {string} content - Content to analyze
 * @returns {number} Ratio of Thai characters to total characters
 */
function detectThaiContent(content) {
  if (!content) return 0;
  const thaiChars = (content.match(/[\u0E00-\u0E7F]/g) || []).length;
  const totalChars = content.replace(/\s/g, "").length || 1;
  return thaiChars / totalChars;
}

/**
 * Get font stack based on language and content
 * @param {string} lang - Language code ("en" or "th")
 * @param {string} content - Content to analyze
 * @param {string} customFont - Custom font name
 * @returns {string} Font stack string
 */
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

/**
 * Extract title from content
 * @param {string} content - Content to extract title from
 * @param {number} maxLen - Maximum length of title
 * @param {string} fallback - Fallback title
 * @returns {string} Extracted title
 */
function extractTitleFromContent(content, maxLen = 0, fallback) {
  const match = content.match(/^#\s+(.+)$/m);
  let title = match ? match[1].replace(/[*_`~]/g,"").replace(/\s+/g," ").trim() : fallback;
  if (maxLen > 0 && [...title].length > maxLen) title = [...title].slice(0, maxLen - 1).join("") + "…";
  return title;
}

/**
 * Frontmatter keys
 * @type {string[]}
 */
const FM_KEYS = ["title","author","date","tags","description","theme","toc","cover","format","headerText","footerText","noPageNumbers","font","lang","template","watermark"];

/**
 * Check if value is truthy
 * @param {any} value - Value to check
 * @returns {boolean} True if truthy
 */
function _isTruthy(value) {
  if (!value) return false;
  const v = value.toString().toLowerCase().trim();
  return v === "true" || v === "yes" || v === "on" || v === "1";
}

/**
 * Parse frontmatter value
 * @param {string} fm - Frontmatter content
 * @param {string} key - Key to parse
 * @returns {string} Parsed value
 */
function _parseFmValue(fm, key) {
  if (!FM_KEYS.includes(key)) return "";
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Try YAML block scalar: key: | \n  value
  const blockRe = new RegExp(`^${escapedKey}:\\s*\\|\\s*\\n([\\s\\S]*?)(?=\\n[^ \\n]|\\n$|$)`, "m");
  const blockMatch = fm.match(blockRe);
  if (blockMatch) return blockMatch[1].replace(/^\s+/gm, "").trim();
  // Try quoted: key: "value" or key: 'value' (matching same quote type)
  const dqRe = new RegExp(`^${escapedKey}:\\s*"([^"]*?)"\\s*$`, "m");
  const dqMatch = fm.match(dqRe);
  if (dqMatch) return dqMatch[1].trim();
  const sqRe = new RegExp(`^${escapedKey}:\\s*'([^']*?)'\\s*$`, "m");
  const sqMatch = fm.match(sqRe);
  if (sqMatch) return sqMatch[1].trim();
  // Try simple: key: value
  const simpleRe = new RegExp(`^${escapedKey}:\\s*(.+)$`, "m");
  const simpleMatch = fm.match(simpleRe);
  if (simpleMatch) return simpleMatch[1].trim().replace(/^['"]|['"]$/g, "");
  return "";
}

/**
 * Parse frontmatter from content
 * @param {string} content - Content to parse
 * @returns {Object} Parsed frontmatter
 */
function parseFrontmatter(content) {
  const meta = { title: "", author: "", date: "", tags: [], description: "", rawLength: 0,
    theme: "", toc: false, cover: false, format: "", headerText: "", footerText: "",
    noPageNumbers: false, font: "", lang: "", template: "", watermark: "", _explicitKeys: new Set() };
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (match) {
    const fm = match[1];
    meta.title = _parseFmValue(fm, "title");
    if (meta.title) meta._explicitKeys.add("title");
    meta.author = _parseFmValue(fm, "author");
    if (meta.author) meta._explicitKeys.add("author");
    meta.date = _parseFmValue(fm, "date");
    if (meta.date) meta._explicitKeys.add("date");
    meta.description = _parseFmValue(fm, "description");
    if (meta.description) meta._explicitKeys.add("description");
    const tg = _parseFmValue(fm, "tags");
    if (tg) { meta.tags = tg.split(",").map(s => s.trim()); meta._explicitKeys.add("tags"); }
    const theme = _parseFmValue(fm, "theme");
    if (theme) { meta.theme = theme; meta._explicitKeys.add("theme"); }
    const toc = _parseFmValue(fm, "toc");
    if (toc) { if (_isTruthy(toc)) meta.toc = true; meta._explicitKeys.add("toc"); }
    const cover = _parseFmValue(fm, "cover");
    if (cover) { if (_isTruthy(cover)) meta.cover = true; meta._explicitKeys.add("cover"); }
    const format = _parseFmValue(fm, "format");
    if (format) { meta.format = format; meta._explicitKeys.add("format"); }
    const headerText = _parseFmValue(fm, "headerText");
    if (headerText) { meta.headerText = headerText; meta._explicitKeys.add("headerText"); }
    const footerText = _parseFmValue(fm, "footerText");
    if (footerText) { meta.footerText = footerText; meta._explicitKeys.add("footerText"); }
    const noPageNumbers = _parseFmValue(fm, "noPageNumbers");
    if (noPageNumbers) { if (_isTruthy(noPageNumbers)) meta.noPageNumbers = true; meta._explicitKeys.add("noPageNumbers"); }
    const font = _parseFmValue(fm, "font");
    if (font) { meta.font = font; meta._explicitKeys.add("font"); }
    const lang = _parseFmValue(fm, "lang");
    if (lang) { meta.lang = lang; meta._explicitKeys.add("lang"); }
    const template = _parseFmValue(fm, "template");
    if (template) { meta.template = template; meta._explicitKeys.add("template"); }
    const watermark = _parseFmValue(fm, "watermark");
    if (watermark) { meta.watermark = watermark; meta._explicitKeys.add("watermark"); }
    meta.rawLength = match[0].length;
  }
  return meta;
}

/**
 * Strip frontmatter from content
 * @param {string} content - Content to strip
 * @returns {string} Content without frontmatter
 */
function stripFrontmatter(content) { return content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, ""); }

/**
 * Slugify text
 * @param {string} text - Text to slugify
 * @returns {string} Slugified text
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\u0E00-\u0E7F\s-]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** 
 * Generate Table of Contents from headings
 * @param {string} content - Markdown content
 * @returns {string} TOC markdown string
 */
function generateToc(content) {
  const headings = [];
  const idCounts = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^(#{1,3})\s+(.+)$/);
    if (m) {
      const text = m[2].replace(/[*_`~]/g,"").trim();
      let id = slugify(text);
      if (idCounts[id] !== undefined) { idCounts[id]++; id = `${id}-${idCounts[id]}`; } else { idCounts[id] = 0; }
      headings.push({ level: m[1].length, text, id });
    }
  }
  if (!headings.length) return "";
  let toc = "\n---\n\n## สารบัญ / Table of Contents\n\n";
  for (const h of headings) { const indent = h.level === 1 ? "" : h.level === 2 ? "  " : "    "; toc += `${indent}- [${h.text}](#${h.id})\n`; }
  return toc + "\n---\n\n";
}

/**
 * Generate cover page HTML
 * @param {string} title - Document title
 * @param {string} author - Document author
 * @param {string} date - Document date
 * @returns {string} Cover page HTML string
 */
function generateCoverPage(title, author, date) {
  let cover = `<div class="cover-page">\n\n# ${escapeHtml(title)}\n\n`;
  if (author) cover += `<div class="cover-author">${escapeHtml(author)}</div>\n\n`;
  cover += `<div class="cover-date">${escapeHtml(date)}</div>\n\n</div>\n\n`;
  return cover;
}

/**
 * Add metadata to PDF using pdf-lib
 * @param {Buffer|Uint8Array} pdfBytes - PDF bytes
 * @param {Object} metadata - Metadata object with Title, Author, Subject, Keywords, Creator
 * @returns {Promise<Uint8Array>} Modified PDF bytes
 */
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

/**
 * Merge multiple PDF buffers into one
 * @param {Buffer[]} pdfBuffers - Array of PDF buffers
 * @returns {Promise<Uint8Array>} Merged PDF bytes
 */
async function mergePdfBuffers(pdfBuffers) {
  const mergedPdf = await PDFDocument.create();
  for (const buf of pdfBuffers) {
    const doc = await PDFDocument.load(buf);
    const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
    for (const page of pages) mergedPdf.addPage(page);
  }
  return await mergedPdf.save();
}

/**
 * Add diagonal watermark text to PDF
 * @param {Buffer|Uint8Array} pdfBytes - PDF bytes
 * @param {string} text - Watermark text
 * @returns {Promise<Uint8Array>} Watermarked PDF bytes
 */
async function addWatermark(pdfBytes, text) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  if (/[\u0E00-\u0E7F]/.test(text)) {
    console.warn("  Warning: Watermark skipped — Thai characters not supported by built-in PDF font");
    return pdfBytes;
  }
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const lines = text.split(/\\n|\n/);
  const lineHeight = 48;
  const totalHeight = (lines.length - 1) * lineHeight;
  for (const page of pages) {
    const { width, height } = page.getSize();
    lines.forEach((line, i) => {
      page.drawText(line, {
        x: width / 2 - font.widthOfTextAtSize(line, 40) / 2,
        y: height / 2 + totalHeight / 2 - i * lineHeight,
        size: 40,
        font,
        color: rgb(0.7, 0.7, 0.7),
        opacity: 0.3,
        rotate: degrees(-45),
      });
    });
  }
  return await pdfDoc.save();
}

/**
 * Resolve output filename from pattern
 * @param {string} pattern - Filename pattern with {name}, {date}, {time}, {timestamp}
 * @param {string} baseName - Base filename without extension
 * @returns {string} Resolved filename
 */
function resolveOutputFilename(pattern, baseName) {
  const now = new Date();
  return pattern
    .replace(/\{name\}/g, baseName)
    .replace(/\{date\}/g, now.toISOString().slice(0, 10))
    .replace(/\{time\}/g, now.toTimeString().slice(0, 8).replace(/:/g, "-"))
    .replace(/\{timestamp\}/g, now.getTime().toString());
}

/**
 * Convert cryptic errors to user-friendly messages
 * @param {unknown} err - Error object or value
 * @returns {string} Friendly error message
 */
function friendlyError(err) {
  const msg = err?.message ?? String(err);
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

//  Core API: md2pdfTh()

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

  // Read markdown
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

  // Parse frontmatter, strip, sanitize
  const frontmatter = parseFrontmatter(mdContent);
  const baseName = inputPath ? path.basename(inputPath, ".md") : "Untitled";
  const title = frontmatter.title || extractTitleFromContent(mdContent, 0, baseName);
  const headerTitle = extractTitleFromContent(mdContent, 60, baseName);

  // Merge frontmatter options (frontmatter overrides defaults only if explicitly set)
  const ek = frontmatter._explicitKeys;
  const fmTheme = ek.has("theme") ? frontmatter.theme : theme;
  const fmToc = ek.has("toc") ? frontmatter.toc : toc;
  const fmCover = ek.has("cover") ? frontmatter.cover : cover;
  const fmFormat = ek.has("format") ? frontmatter.format : format;
  const fmHeaderText = ek.has("headerText") ? frontmatter.headerText : headerText;
  const fmFooterText = ek.has("footerText") ? frontmatter.footerText : footerText;
  const fmNoPageNumbers = ek.has("noPageNumbers") ? frontmatter.noPageNumbers : noPageNumbers;
  const fmFont = ek.has("font") ? frontmatter.font : font;
  const fmLang = ek.has("lang") ? frontmatter.lang : lang;
  const fmTemplate = ek.has("template") ? frontmatter.template : template;
  const fmWatermark = ek.has("watermark") ? frontmatter.watermark : watermark;

  let finalContent = stripFrontmatter(mdContent);

  // TOC (before sanitize to preserve heading structure)
  let tocContent = "";
  if (fmToc) {
    tocContent = generateToc(finalContent);
  }

  // Cover page
  if (fmCover) {
    const coverTitle = frontmatter.title || title;
    const coverDate = frontmatter.date || new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
    finalContent = generateCoverPage(coverTitle, frontmatter.author, coverDate) + finalContent;
  }

  // Insert TOC after cover page or at top
  if (fmToc) {
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

  // Sanitize
  finalContent = sanitizeHtml(finalContent);

  // CSS — template, theme, or custom (base + theme vars composed)
  const baseCss = await readCssCached(BASE_CSS_PATH);
  let css;
  if (fmTemplate) {
    const templatePath = path.join(TEMPLATE_DIR, `${fmTemplate}.css`);
    if (fs.existsSync(templatePath)) {
      css = await readCssCached(templatePath);
    } else {
      console.warn(`  Warning: Template '${fmTemplate}' not found at ${templatePath}, falling back to theme CSS`);
      const cssFile = fmTheme === "dark" ? DARK_CSS_PATH : DEFAULT_CSS_PATH;
      css = await readCssCached(cssFile) + "\n" + baseCss;
    }
  } else if (customCss) {
    css = customCss;
  } else if (cssPath) {
    css = fs.existsSync(cssPath) ? await readCssCached(cssPath) : "";
  } else {
    const cssFile = fmTheme === "dark" ? DARK_CSS_PATH : DEFAULT_CSS_PATH;
    css = await readCssCached(cssFile) + "\n" + baseCss;
  }

  // Auto font injection based on content detection
  const fontStack = getFontStack(fmLang, mdContent, fmFont);
  css = `body { font-family: ${fontStack} !important; }\n` + css;

  // Header/Footer templates
  const headerFooterColor = fmTheme === "dark" ? "#cbd5e1" : "#94a3b8";
  const showHeader = fmHeaderText || !fmNoPageNumbers;
  const showFooter = fmFooterText || !fmNoPageNumbers;
  let headerTemplate = "";
  if (showHeader) {
    if (fmHeaderText) {
      headerTemplate = `<div style="font-size:8px;width:100%;text-align:center;color:${headerFooterColor}">${escapeHtml(fmHeaderText)}</div>`;
    } else if (!fmNoPageNumbers) {
      headerTemplate = PAGE_HEADER_TEMPLATE.replace("#94a3b8", headerFooterColor);
    }
  }
  let footerTemplate = "";
  if (showFooter) {
    if (fmFooterText) {
      footerTemplate = `<div style="font-size:9px;width:100%;text-align:center;color:${headerFooterColor}">${escapeHtml(fmFooterText)}</div>`;
    } else if (!fmNoPageNumbers) {
      footerTemplate = PAGE_FOOTER_TEMPLATE.replace("#94a3b8", headerFooterColor);
    }
  }
  const displayHeaderFooter = !!(showHeader || showFooter);
  const marginConfig = displayHeaderFooter ? { top:"25mm",bottom:"25mm",left:"15mm",right:"15mm" } : { top:"20mm",bottom:"20mm",left:"15mm",right:"15mm" };

  // Puppeteer
  const launchArgs = ["--font-render-hinting=medium"];
  if (process.env.CI) launchArgs.push("--no-sandbox", "--disable-setuid-sandbox");

  // Convert
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

  // Add metadata via pdf-lib
  let pdfBuffer = Buffer.from(pdf.content);
  try {
    const modifiedBytes = await addPdfMetadata(pdfBuffer, {
      Title: headerTitle,
      Author: frontmatter.author || "md2pdf-th",
      Subject: "Markdown document converted to PDF",
      Keywords: frontmatter.tags.length ? frontmatter.tags.join(", ") : "markdown, pdf",
      Creator: `md2pdf-th v${VERSION}`,
    });
    pdfBuffer = Buffer.from(modifiedBytes);
  } catch (metaErr) { console.warn(`  Warning: PDF metadata injection failed: ${metaErr.message}`); }

  // Watermark
  if (fmWatermark) {
    try {
      const watermarked = await addWatermark(pdfBuffer, fmWatermark);
      pdfBuffer = Buffer.from(watermarked);
    } catch (wmErr) { console.warn(`  Warning: Watermark failed: ${wmErr.message}`); }
  }

  // Write to file or return Buffer
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
