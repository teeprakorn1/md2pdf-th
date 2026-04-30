#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const http = require("http");
const { mdToPdf } = require("md-to-pdf");
const { PDFDocument } = require("pdf-lib");
const { marked } = require("marked");

const VERSION = "2.0.0";
const CONCURRENCY_LIMIT = 4;
const DEFAULT_CSS_PATH = path.join(__dirname, "style.css");
const DARK_CSS_PATH = path.join(__dirname, "style-dark.css");
const PAGE_SIZES = ["A3", "A4", "A5", "Letter", "Legal", "Tabloid"];
const PAGE_HEADER_TEMPLATE = `<div style="font-size:8px;width:100%;text-align:center;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%"><span class="title"></span></div>`;
const PAGE_FOOTER_TEMPLATE = `<div style="font-size:9px;width:100%;text-align:center;color:#94a3b8"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`;

function parseArgs(argv) {
  const args = { files: [], cssPath: null, outDir: null, noPageNumbers: false,
    theme: "light", toc: false, watch: false, merge: false, cover: false,
    headerText: null, footerText: null, format: "A4", font: null, serve: false, servePort: 3000 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--help": case "-h": args.help = true; break;
      case "--version": case "-v": args.version = true; break;
      case "--css": args.cssPath = argv[++i]; if (!args.cssPath || args.cssPath.startsWith("-")) { console.error("Error: --css requires a path argument"); args.error = true; args.cssPath = null; } break;
      case "--outdir": case "-o": args.outDir = argv[++i]; if (!args.outDir || args.outDir.startsWith("-")) { console.error("Error: --outdir requires a directory argument"); args.error = true; args.outDir = null; } break;
      case "--no-page-numbers": args.noPageNumbers = true; break;
      case "--theme": args.theme = argv[++i]; if (!["light","dark"].includes(args.theme)) { console.error("Error: --theme must be 'light' or 'dark'"); args.error = true; } break;
      case "--toc": args.toc = true; break;
      case "--watch": args.watch = true; break;
      case "--merge": args.merge = true; break;
      case "--cover": args.cover = true; break;
      case "--header": args.headerText = argv[++i]; if (!args.headerText || args.headerText.startsWith("-")) { console.error("Error: --header requires a text argument"); args.error = true; args.headerText = null; } break;
      case "--footer": args.footerText = argv[++i]; if (!args.footerText || args.footerText.startsWith("-")) { console.error("Error: --footer requires a text argument"); args.error = true; args.footerText = null; } break;
      case "--format": args.format = argv[++i]; if (!PAGE_SIZES.includes(args.format)) { console.error(`Error: --format must be one of: ${PAGE_SIZES.join(", ")}`); args.error = true; } break;
      case "--font": args.font = argv[++i]; if (!args.font || args.font.startsWith("-")) { console.error("Error: --font requires a font name argument"); args.error = true; args.font = null; } break;
      case "--serve": args.serve = true; break;
      case "--port": args.servePort = parseInt(argv[++i], 10); if (isNaN(args.servePort) || args.servePort < 1 || args.servePort > 65535) { console.error("Error: --port requires a valid port number (1-65535)"); args.error = true; } break;
      default: if (arg.startsWith("-")) { console.error(`Unknown option: ${arg}`); args.error = true; } else { args.files.push(arg); } break;
    }
  }
  const nonMd = args.files.findIndex(f => !f.endsWith(".md"));
  if (nonMd === 1 && args.files.length >= 2) { args.outputPath = path.resolve(args.files[nonMd]); args.files.splice(nonMd, 1); }
  return args;
}

function printUsage() {
  console.log(`\n  md2pdf v${VERSION} — Markdown to PDF Converter (Thai/English)\n  ============================================================\n\n  Usage:\n    md2pdf-th <file.md> [output.pdf]\n    md2pdf-th <file1.md> <file2.md> ...          (batch convert)\n    md2pdf-th [options] <file.md>\n\n  Options:\n    --css <path>           Custom CSS file path\n    --outdir, -o <dir>     Output directory\n    --no-page-numbers      Disable page numbers\n    --theme <light|dark>   Color theme (default: light)\n    --toc                  Generate Table of Contents\n    --watch                Watch mode — reconvert on file change\n    --merge                Merge multiple PDFs into one\n    --cover                Add cover page from frontmatter\n    --header <text>        Custom header text\n    --footer <text>        Custom footer text\n    --format <size>        Page size: A3, A4, A5, Letter, Legal, Tabloid\n    --font <name>          Custom font family\n    --serve                Start web preview server\n    --port <port>          Server port (default: 3000)\n    --version, -v          Show version\n    --help, -h             Show this help\n  `);
}

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

function validatePath(inputPath, label) {
  if (inputPath.includes("..")) { console.error(`Error: ${label} contains path traversal (..)`); return null; }
  return path.resolve(inputPath);
}

function extractTitleFromContent(content, maxLen = 0, fallback) {
  const match = content.match(/^#\s+(.+)$/m);
  let title = match ? match[1].replace(/[*_`~]/g,"").replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu,"").replace(/\s+/g," ").trim() : fallback;
  if (maxLen > 0 && title.length > maxLen) title = title.slice(0, maxLen - 1) + "…";
  return title;
}

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

function generateCoverPage(title, author, date) {
  let cover = `<div class="cover-page">\n\n# ${escapeHtml(title)}\n\n`;
  if (author) cover += `<div class="cover-author">${escapeHtml(author)}</div>\n\n`;
  cover += `<div class="cover-date">${escapeHtml(date)}</div>\n\n</div>\n\n`;
  return cover;
}

function resolveOutputPath(inputPath, options) {
  if (options.outputPath && options.files.length === 1) return options.outputPath;
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const dir = options.outDir ? path.resolve(options.outDir) : path.dirname(inputPath);
  if (options.outDir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${baseName}.pdf`);
}

async function addPdfMetadata(pdfPath, metadata) {
  try {
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfDoc.setTitle(metadata.Title || "");
    pdfDoc.setAuthor(metadata.Author || "");
    pdfDoc.setSubject(metadata.Subject || "");
    pdfDoc.setKeywords(metadata.Keywords ? metadata.Keywords.split(", ").map(k => k.trim()) : []);
    pdfDoc.setCreator(metadata.Creator || "");
    pdfDoc.setProducer("md2pdf-th");
    pdfDoc.setCreationDate(new Date());
    fs.writeFileSync(pdfPath, await pdfDoc.save());
  } catch (metaErr) { console.warn(`  Warning: Could not add PDF metadata: ${metaErr.message}`); }
}

async function mergePdfs(pdfPaths, outputPath) {
  try {
    const mergedPdf = await PDFDocument.create();
    for (const pdfPath of pdfPaths) {
      if (!fs.existsSync(pdfPath)) { console.error(`  Warning: Merge — file not found: ${pdfPath}`); continue; }
      const doc = await PDFDocument.load(fs.readFileSync(pdfPath));
      const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
      for (const page of pages) mergedPdf.addPage(page);
    }
    fs.writeFileSync(outputPath, await mergedPdf.save());
    console.log(`  Merged ${pdfPaths.length} PDFs → ${outputPath}`);
    return true;
  } catch (err) { console.error(`  Error: Merge failed: ${err.message}`); return false; }
}

async function convertFile(inputPath, options) {
  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) { console.error(`  Error: File not found: ${inputPath}`); return { success: false, outputPath: null }; }
  if (!resolvedInput.toLowerCase().endsWith(".md")) { console.error(`  Error: Not a .md file: ${inputPath}`); return { success: false, outputPath: null }; }

  const outputPath = resolveOutputPath(resolvedInput, options);
  let cssFile = options.cssPath || (options.theme === "dark" ? DARK_CSS_PATH : DEFAULT_CSS_PATH);
  let css = fs.existsSync(cssFile) ? fs.readFileSync(cssFile, "utf-8") : "";
  if (options.font) css = `body { font-family: '${options.font}', 'Noto Sans Thai', 'Segoe UI Emoji', sans-serif !important; }\n` + css;

  let mdContent;
  try { mdContent = fs.readFileSync(resolvedInput, "utf-8"); } catch (err) { console.error(`  Error: Failed to read file: ${err.message}`); return { success: false, outputPath: null }; }

  const frontmatter = parseFrontmatter(mdContent);
  const baseName = path.basename(resolvedInput, ".md");
  const title = extractTitleFromContent(mdContent, 0, baseName);
  const headerTitle = extractTitleFromContent(mdContent, 60, baseName);

  let finalContent = sanitizeHtml(stripFrontmatter(mdContent));

  if (options.cover) {
    const coverDate = frontmatter.date || new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
    finalContent = generateCoverPage(title, frontmatter.author, coverDate) + finalContent;
  }
  if (options.toc) {
    const tocContent = generateToc(finalContent);
    if (options.cover) { const coverEnd = finalContent.indexOf("</div>") + 6; finalContent = finalContent.slice(0, coverEnd) + "\n\n" + tocContent + finalContent.slice(coverEnd); }
    else { finalContent = tocContent + finalContent; }
  }

  const headerTemplate = options.noPageNumbers ? "" : options.headerText ? `<div style="font-size:8px;width:100%;text-align:center;color:#94a3b8">${escapeHtml(options.headerText)}</div>` : PAGE_HEADER_TEMPLATE;
  const footerTemplate = options.noPageNumbers ? "" : options.footerText ? `<div style="font-size:9px;width:100%;text-align:center;color:#94a3b8">${escapeHtml(options.footerText)}</div>` : PAGE_FOOTER_TEMPLATE;
  const marginConfig = options.noPageNumbers ? { top:"20mm",bottom:"20mm",left:"15mm",right:"15mm" } : { top:"25mm",bottom:"25mm",left:"15mm",right:"15mm" };

  const launchArgs = ["--font-render-hinting=medium"];
  if (process.env.CI) launchArgs.push("--no-sandbox", "--disable-setuid-sandbox");

  try {
    const pdf = await mdToPdf({ content: finalContent }, {
      dest: outputPath, css, document_title: headerTitle,
      launch_options: { args: launchArgs },
      pdf_options: { format: options.format || "A4", margin: marginConfig, printBackground: true, displayHeaderFooter: !options.noPageNumbers, headerTemplate, footerTemplate, preferCSSPageSize: false },
      body: `<script>document.title = ${JSON.stringify(headerTitle)};</script>`,
    });
    if (pdf && fs.existsSync(outputPath)) {
      await addPdfMetadata(outputPath, { Title: headerTitle, Author: "md2pdf-th", Subject: "Markdown document converted to PDF", Keywords: "markdown, pdf", Creator: `md2pdf-th v${VERSION}` });
    }
    return { success: !!pdf, outputPath };
  } catch (error) { console.error(`  Error: ${error.message}`); return { success: false, outputPath: null }; }
}

async function runWithConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  const executing = new Set();
  for (let i = 0; i < tasks.length; i++) {
    const promise = tasks[i]().then(result => { results[i] = result; executing.delete(promise); });
    executing.add(promise);
    if (executing.size >= limit) await Promise.race(executing);
  }
  await Promise.all(executing);
  return results;
}

function startWatchMode(inputPath, options) {
  const resolvedInput = path.resolve(inputPath);
  console.log(`\n👀 Watching: ${inputPath} (Ctrl+C to stop)\n`);
  let lastConvert = 0, converting = false;
  const doConvert = async () => {
    const now = Date.now();
    if (now - lastConvert < 500 || converting) return;
    lastConvert = now; converting = true;
    try {
      console.log(`\n[${new Date().toLocaleTimeString()}] File changed — reconverting...`);
      const result = await convertFile(inputPath, options);
      if (result.success) console.log(`  Done! → ${result.outputPath}`);
      else console.error(`  Conversion failed — will retry on next change`);
    } catch (err) { console.error(`  Watch error: ${err.message}`); }
    finally { converting = false; }
  };
  fs.watch(resolvedInput, (eventType) => { if (eventType === "change") doConvert(); });
  doConvert();
}

function startServer(inputPath, options) {
  const port = options.servePort;
  console.log(`\n🌐 Web preview server starting on http://localhost:${port}`);
  console.log(`   ⚠️  WARNING: No authentication — do not expose to public networks`);
  let lastHtml = "";
  const convertToHtml = async () => {
    try {
      const resolvedInput = path.resolve(inputPath);
      if (!fs.existsSync(resolvedInput)) return;
      let mdContent = fs.readFileSync(resolvedInput, "utf-8");
      const frontmatter = parseFrontmatter(mdContent);
      mdContent = sanitizeHtml(stripFrontmatter(mdContent));
      if (options.toc) mdContent = generateToc(mdContent) + mdContent;
      const baseName = path.basename(resolvedInput, ".md");
      const title = extractTitleFromContent(mdContent, 0, baseName);
      if (options.cover) { const coverDate = frontmatter.date || new Date().toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"}); mdContent = generateCoverPage(title, frontmatter.author, coverDate) + mdContent; }
      const cssFile = options.theme === "dark" ? DARK_CSS_PATH : DEFAULT_CSS_PATH;
      const css = fs.existsSync(cssFile) ? fs.readFileSync(cssFile, "utf-8") : "";
      lastHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${marked.parse(mdContent)}</body></html>`;
    } catch (err) { lastHtml = `<!DOCTYPE html><html><body><p>Error: ${escapeHtml(err.message)}</p></body></html>`; }
  };
  const resolvedInput = path.resolve(inputPath);
  if (fs.existsSync(resolvedInput)) { let lastWatch = 0; fs.watch(resolvedInput, () => { const now = Date.now(); if (now - lastWatch > 500) { lastWatch = now; convertToHtml(); } }); }
  const server = http.createServer((req, res) => {
    if (req.url === "/") { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(lastHtml || "<p>Loading...</p>"); }
    else { res.writeHead(404); res.end("Not found"); }
  });
  convertToHtml().then(() => { server.listen(port, "127.0.0.1", () => { console.log(`   Ready! Open http://localhost:${port}`); }); });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.error) { printUsage(); process.exit(1); }
  if (options.help) { printUsage(); process.exit(0); }
  if (options.version) { console.log(`md2pdf v${VERSION}`); process.exit(0); }
  if (options.files.length === 0) { console.error("Error: No input file specified. Use --help for usage."); process.exit(1); }
  for (const f of options.files) { if (!validatePath(f, "Input file")) process.exit(1); }
  if (options.cssPath && !validatePath(options.cssPath, "--css path")) process.exit(1);
  if (options.outDir && options.outDir.includes("..")) { console.error("Error: --outdir contains path traversal (..)"); process.exit(1); }

  if (options.serve) { startServer(options.files[0], options); return; }
  if (options.watch) { startWatchMode(options.files[0], options); return; }

  const total = options.files.length;
  let success = 0, failed = 0;

  if (options.merge && total > 1) {
    console.log(`Converting ${total} files, then merging...\n`);
    const tasks = options.files.map((inputPath, index) => async () => {
      console.log(`[${index + 1}/${total}] Converting: ${path.basename(inputPath)}`);
      return convertFile(inputPath, options);
    });
    const results = await runWithConcurrency(tasks, CONCURRENCY_LIMIT);
    const pdfPaths = results.filter(r => r.success).map(r => r.outputPath);
    const mergeOutput = options.outDir ? path.join(path.resolve(options.outDir), "merged.pdf") : path.join(path.dirname(path.resolve(options.files[0])), "merged.pdf");
    if (pdfPaths.length > 1) { const mergeOk = await mergePdfs(pdfPaths, mergeOutput); if (mergeOk) success = pdfPaths.length; else failed = pdfPaths.length; }
    else { console.error("  Error: Need at least 2 successful conversions to merge."); failed = total; }
    console.log(`\nResults: ${success} succeeded, ${failed} failed out of ${total} files`);
    process.exit(failed > 0 ? 1 : 0);
  }

  if (total > 1) {
    console.log(`Converting ${total} files with concurrency limit ${CONCURRENCY_LIMIT}...\n`);
    const tasks = options.files.map((inputPath, index) => async () => {
      console.log(`[${index + 1}/${total}] Converting: ${path.basename(inputPath)}`);
      const result = await convertFile(inputPath, options);
      if (result.success) console.log(`  Done! → ${result.outputPath}`);
      return result;
    });
    const results = await runWithConcurrency(tasks, CONCURRENCY_LIMIT);
    results.forEach(r => { if (r.success) success++; else failed++; });
    console.log(`\nResults: ${success} succeeded, ${failed} failed out of ${total} files`);
  } else {
    const inputPath = options.files[0];
    const outputPath = resolveOutputPath(path.resolve(inputPath), options);
    console.log(`Converting: ${path.basename(inputPath)}`);
    console.log(`Output:     ${path.basename(outputPath)}`);
    const result = await convertFile(inputPath, options);
    if (result.success) { console.log(`  Done! → ${outputPath}`); success++; } else { failed++; }
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
