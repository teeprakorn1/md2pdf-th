#!/usr/bin/env node
/**
 * md2pdf-th CLI — thin wrapper around md2pdfTh core engine
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { md2pdfTh, md2html, mergePdfBuffers, VERSION, PAGE_SIZES, sanitizeHtml, stripFrontmatter, parseFrontmatter, extractTitleFromContent, generateToc, generateCoverPage, escapeHtml, marked } = require("./lib/md2pdf-core");

const CONCURRENCY_LIMIT = 4;
const DEFAULT_CSS_PATH = path.join(__dirname, "style.css");
const DARK_CSS_PATH = path.join(__dirname, "style-dark.css");
const BASE_CSS_PATH = path.join(__dirname, "style-base.css");

/**
 * Parse command line arguments
 * @param {string[]} argv - Command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs(argv) {
  const args = { files: [], cssPath: null, outDir: null, noPageNumbers: false,
    theme: "light", toc: false, watch: false, merge: false, cover: false,
    headerText: null, footerText: null, format: "A4", font: null, serve: false, servePort: 3000,
    template: null, watermark: null, outputFilename: null, lang: "th",
    htmlOnly: false, timeout: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--help": case "-h": args.help = true; break;
      case "--version": case "-v": args.version = true; break;
      case "--css": args.cssPath = argv[++i]; if (args.cssPath === undefined) { console.error("Error: --css requires a path argument"); args.error = true; args.cssPath = null; } break;
      case "--outdir": case "-o": args.outDir = argv[++i]; if (args.outDir === undefined) { console.error("Error: --outdir requires a directory argument"); args.error = true; args.outDir = null; } break;
      case "--no-page-numbers": args.noPageNumbers = true; break;
      case "--theme": args.theme = argv[++i]; if (!["light","dark"].includes(args.theme)) { console.error("Error: --theme must be 'light' or 'dark'"); args.error = true; } break;
      case "--toc": args.toc = true; break;
      case "--watch": args.watch = true; break;
      case "--merge": args.merge = true; break;
      case "--cover": args.cover = true; break;
      case "--header": args.headerText = argv[++i]; if (args.headerText === undefined) { console.error("Error: --header requires a text argument"); args.error = true; args.headerText = null; } break;
      case "--footer": args.footerText = argv[++i]; if (args.footerText === undefined) { console.error("Error: --footer requires a text argument"); args.error = true; args.footerText = null; } break;
      case "--format": args.format = argv[++i]; if (!PAGE_SIZES.includes(args.format)) { console.error(`Error: --format must be one of: ${PAGE_SIZES.join(", ")}`); args.error = true; } break;
      case "--font": args.font = argv[++i]; if (args.font === undefined) { console.error("Error: --font requires a font name argument"); args.error = true; args.font = null; } break;
      case "--lang": args.lang = argv[++i]; if (!["th","en"].includes(args.lang)) { console.error("Error: --lang must be 'th' or 'en'"); args.error = true; } break;
      case "--template": args.template = argv[++i]; if (args.template === undefined) { console.error("Error: --template requires a name argument"); args.error = true; args.template = null; } break;
      case "--watermark": args.watermark = argv[++i]; if (args.watermark === undefined) { console.error("Error: --watermark requires a text argument"); args.error = true; args.watermark = null; } break;
      case "--output-filename": args.outputFilename = argv[++i]; if (args.outputFilename === undefined) { console.error("Error: --output-filename requires a pattern argument"); args.error = true; args.outputFilename = null; } break;
      case "--concurrency": args.concurrencyLimit = parseInt(argv[++i], 10); if (isNaN(args.concurrencyLimit) || args.concurrencyLimit < 1 || args.concurrencyLimit > 32) { console.error("Error: --concurrency must be 1-32"); args.error = true; } break;
      case "--serve": args.serve = true; break;
      case "--html-only": args.htmlOnly = true; break;
      case "--timeout": args.timeout = parseInt(argv[++i], 10); if (isNaN(args.timeout) || args.timeout < 1000) { console.error("Error: --timeout must be at least 1000 ms"); args.error = true; } break;
      case "--port": args.servePort = parseInt(argv[++i], 10); if (isNaN(args.servePort) || args.servePort < 1 || args.servePort > 65535) { console.error("Error: --port requires a valid port number (1-65535)"); args.error = true; } break;
      default: if (arg.startsWith("-")) { console.error(`Unknown option: ${arg}`); args.error = true; } else { args.files.push(arg); } break;
    }
  }
  /**
   * Handle output file specification
   */
  const nonMd = args.files.findIndex(f => !f.endsWith(".md") && (f.endsWith(".pdf") || (args.htmlOnly && f.endsWith(".html"))));
  if (nonMd !== -1 && args.files.length >= 2) {
    if (args.files[nonMd].includes("..")) { console.error("Error: Output file contains path traversal (..)"); args.error = true; }
    else { args.outputPath = path.resolve(args.files[nonMd]); args.files.splice(nonMd, 1); }
  }
  return args;
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`\n  md2pdf v${VERSION} — Markdown to PDF Converter (Thai/English)\n  ============================================================\n\n  Usage:\n    md2pdf-th <file.md> [output.pdf]\n    md2pdf-th <file1.md> <file2.md> ...          (batch convert)\n    md2pdf-th [options] <file.md>\n\n  Options:\n    --css <path>           Custom CSS file path\n    --outdir, -o <dir>     Output directory\n    --no-page-numbers      Disable page numbers\n    --theme <light|dark>   Color theme (default: light)\n    --toc                  Generate Table of Contents\n    --watch                Watch mode — reconvert on file change\n    --merge                Merge multiple PDFs into one\n    --cover                Add cover page from frontmatter\n    --header <text>        Custom header text\n    --footer <text>        Custom footer text\n    --format <size>        Page size: A3, A4, A5, Letter, Legal, Tabloid\n    --font <name>          Custom font family\n    --lang <th|en>         Language hint for font selection (default: th)\n    --template <name>      Built-in template: resume, report, invoice\n    --watermark <text>     Diagonal watermark text\n    --output-filename <pat> Output filename pattern: {name}, {date}, {time}, {timestamp}\n    --concurrency <n>      Batch concurrency limit 1-32 (default: 4)\n    --serve                Start web preview server\n    --port <port>          Server port (default: 3000)\n    --html-only            Export HTML instead of PDF (lightweight, no Puppeteer)\n    --timeout <ms>         Conversion timeout in milliseconds (default: 60000)\n    --version, -v          Show version\n    --help, -h             Show this help\n\n  Library API:\n    const { md2pdfTh } = require('md2pdf-th');\n    const pdfBuffer = await md2pdfTh({ content: '# Hello' });\n  `);
}

/**
 * Build core options from CLI args
 */
function buildCoreOptions(args, inputPath, outputPath) {
  return {
    inputPath,
    outputPath,
    cssPath: args.cssPath,
    theme: args.theme,
    toc: args.toc,
    cover: args.cover,
    headerText: args.headerText,
    footerText: args.footerText,
    format: args.format,
    font: args.font,
    noPageNumbers: args.noPageNumbers,
    lang: args.lang,
    template: args.template,
    watermark: args.watermark,
    outputFilename: args.outputFilename,
  };
}

/**
 * Run tasks with concurrency limit
 */
async function runWithConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  const executing = new Set();
  for (let i = 0; i < tasks.length; i++) {
    const promise = tasks[i]().then(result => { results[i] = result; }).finally(() => { executing.delete(promise); });
    executing.add(promise);
    if (executing.size >= limit) await Promise.race(executing);
  }
  await Promise.all(executing);
  return results;
}

/**
 * Start watch mode
 */
function startWatchMode(inputPath, args) {
  console.log(`\n👀 Watching: ${inputPath} (Ctrl+C to stop)\n`);
  let debounceTimer = null, converting = false;
  const doConvert = async () => {
    if (converting) return;
    converting = true;
    try {
      const outputPath = resolveOutputPath(path.resolve(inputPath), args);
      console.log(`\n[${new Date().toLocaleTimeString()}] File changed — reconverting...`);
      await md2pdfTh(buildCoreOptions(args, inputPath, outputPath));
      console.log(`  Done! → ${outputPath}`);
    } catch (err) { console.error(`  ${err.message} — will retry on next change`); }
    finally { converting = false; }
  };
  fs.watchFile(path.resolve(inputPath), { interval: 500 }, () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doConvert, 500);
  });
  doConvert();
}

/**
 * Start web server
 */
function startServer(inputPath, args) {
  const port = args.servePort;
  const authToken = crypto.randomBytes(4).toString("hex");
  console.log(`\n🌐 Web preview server starting on http://localhost:${port}`);
  console.log(`   🔑 Auth token: ${authToken}`);
  console.log(`   ⚠️  Bind: 127.0.0.1 only — do not expose to public networks`);
  let lastHtml = "";

  // Per-IP rate limit with 60s window
  const ipRequests = new Map();
  const RATE_LIMIT_PER_IP = 60;
  const RATE_WINDOW_MS = 60000;

  function checkRateLimit(ip) {
    const now = Date.now();
    // Purge entries older than window to prevent memory leak
    if (ipRequests.size > 1000) {
      const stale = [];
      for (const [key, val] of ipRequests) { if (now - val.windowStart > RATE_WINDOW_MS) stale.push(key); }
      for (const key of stale) ipRequests.delete(key);
    }
    const entry = ipRequests.get(ip) || { count: 0, windowStart: now };
    if (now - entry.windowStart > RATE_WINDOW_MS) { entry.count = 0; entry.windowStart = now; }
    entry.count++;
    ipRequests.set(ip, entry);
    return entry.count <= RATE_LIMIT_PER_IP;
  }

  /**
   * Convert markdown to HTML
   */
  const convertToHtml = async () => {
    try {
      const resolved = path.resolve(inputPath);
      try { await fs.promises.access(resolved); } catch { return; }
      let mdContent = await fs.promises.readFile(resolved, "utf-8");
      const fm = parseFrontmatter(mdContent);
      mdContent = stripFrontmatter(mdContent);
      if (args.toc) mdContent = generateToc(mdContent) + mdContent;
      mdContent = sanitizeHtml(mdContent);
      const title = extractTitleFromContent(mdContent, 0, path.basename(resolved, ".md"));
      if (args.cover) { const d = fm.date || new Date().toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"}); mdContent = generateCoverPage(title, fm.author, d) + mdContent; }
      const cssFile = args.theme === "dark" ? DARK_CSS_PATH : DEFAULT_CSS_PATH;
      let css = "";
      try { const vars = await fs.promises.readFile(cssFile, "utf-8"); const base = await fs.promises.readFile(BASE_CSS_PATH, "utf-8"); css = vars + "\n" + base; } catch { /* no custom css */ }
      lastHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${marked.parse(mdContent)}</body></html>`;
    } catch (err) { lastHtml = `<!DOCTYPE html><html><body><p>Error: ${escapeHtml(err.message)}</p></body></html>`; }
  };

  const resolved = path.resolve(inputPath);
  const inputDir = path.dirname(resolved);
  let debounceTimer = null;
  fs.watchFile(resolved, { interval: 500 }, () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(convertToHtml, 500);
  });

  const MIME_TYPES = { ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".gif":"image/gif", ".svg":"image/svg+xml", ".webp":"image/webp", ".ico":"image/x-icon" };

  const server = http.createServer((req, res) => {
    const ip = req.socket.remoteAddress;
    if (!checkRateLimit(ip)) { res.writeHead(429, { "Content-Type": "text/plain" }); res.end("Rate limit exceeded"); return; }

    const url = new URL(req.url, `http://localhost:${port}`);
    const urlPath = url.pathname;
    const queryToken = url.searchParams.get("token");

    // Auth check — token required for all routes (query param or Authorization header)
    const headerToken = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (queryToken !== authToken && headerToken !== authToken) { res.writeHead(401, { "Content-Type": "text/plain" }); res.end("Unauthorized — pass ?token=<token>"); return; }

    if (urlPath === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(lastHtml || "<p>Loading...</p>");
      return;
    }

    // Serve web UI
    if (urlPath === "/ui") {
      const uiPath = path.join(__dirname, "web-ui.html");
      fs.promises.readFile(uiPath, "utf-8").then(html => {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(html);
      }).catch(() => { res.writeHead(404); res.end("web-ui.html not found"); });
      return;
    }

    // POST /api/convert — convert markdown content to PDF
    if (urlPath === "/api/convert" && req.method === "POST") {
      const MAX_BODY = 1024 * 1024; // 1MB
      let body = "";
      req.on("data", chunk => { body += chunk; if (body.length > MAX_BODY) { res.writeHead(413, { "Content-Type": "text/plain" }); res.end("Request body too large (max 1MB)"); req.destroy(); } });
      req.on("end", async () => {
        try {
          const opts = JSON.parse(body);
          if (!opts.content || typeof opts.content !== "string") { res.writeHead(400, { "Content-Type": "text/plain" }); res.end("Missing content field"); return; }
          const pdfBuffer = await md2pdfTh({
            content: opts.content,
            theme: opts.theme || "light",
            format: opts.format || "A4",
            template: opts.template || undefined,
            toc: !!opts.toc,
          });
          res.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=output.pdf" });
          res.end(pdfBuffer);
        } catch (err) { res.writeHead(500, { "Content-Type": "text/plain" }); res.end("Conversion failed: " + (err.message || "unknown error")); }
      });
      return;
    }

    // Serve images from the same directory as the markdown file
    const ext = path.extname(urlPath).toLowerCase();
    if (MIME_TYPES[ext]) {
      const decoded = decodeURIComponent(urlPath).replace(/^\//, "");
      if (decoded.includes("\0")) { res.writeHead(400); res.end("Bad request"); return; }
      const normalized = path.normalize(path.join(inputDir, decoded));
      if (normalized.startsWith(inputDir + path.sep) && fs.existsSync(normalized)) {
        res.writeHead(200, { "Content-Type": MIME_TYPES[ext] });
        fs.createReadStream(normalized).pipe(res);
        return;
      }
    }

    res.writeHead(404);
    res.end("Not found");
  });
  
  // Convert to HTML first
  convertToHtml().then(() => {
    server.listen(port, "127.0.0.1", () => { console.log(`   Ready! Open http://localhost:${port}/?token=${authToken}`); console.log(`   Web UI: http://localhost:${port}/ui?token=${authToken}`); });
    server.on("error", (err) => { console.error(`   Server error: ${err.message}`); process.exit(1); });
  });
}

/**
 * Resolve output path
 */
function resolveOutputPath(inputPath, args) {
  if (args.outputPath && args.files.length === 1) return args.outputPath;
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const dir = args.outDir ? path.resolve(args.outDir) : path.dirname(inputPath);
  if (args.outDir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${baseName}.pdf`);
}

/**
 * Main function
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.error) { printUsage(); process.exit(1); }
  if (args.help) { printUsage(); process.exit(0); }
  if (args.version) { console.log(`md2pdf v${VERSION}`); process.exit(0); }
  if (args.files.length === 0) { console.error("Error: No input file specified. Use --help for usage."); process.exit(1); }

  // Path validation
  for (const f of args.files) { if (f.includes("..")) { console.error("Error: Input file contains path traversal (..)"); process.exit(1); } }
  if (args.cssPath && args.cssPath.includes("..")) { console.error("Error: --css contains path traversal (..)"); process.exit(1); }
  if (args.outDir && args.outDir.includes("..")) { console.error("Error: --outdir contains path traversal (..)"); process.exit(1); }

  // Check input files exist
  for (const f of args.files) { if (!fs.existsSync(path.resolve(f))) { console.error(`Error: File not found: ${f}`); process.exit(1); } }

  // --watch + --merge conflict
  if (args.watch && args.merge) console.warn("Warning: --merge is ignored in watch mode");
  // --serve + multiple files
  if (args.serve && args.files.length > 1) console.warn(`Warning: --serve uses only the first file, ignoring ${args.files.length - 1} others`);

  if (args.htmlOnly) {
    const inputPath = args.files[0];
    // Check for user-provided output path (e.g., doc.md output.html)
    let htmlPath;
    if (args.outputPath) {
      htmlPath = args.outputPath.replace(/\.pdf$/, '.html');
    } else {
      const baseName = path.basename(inputPath, '.md');
      const outDir = args.outDir ? path.resolve(args.outDir) : path.dirname(path.resolve(inputPath));
      htmlPath = path.join(outDir, baseName + '.html');
    }
    const outDir = path.dirname(htmlPath);
    try {
      const { html } = await md2html({
        inputPath, cssPath: args.cssPath, theme: args.theme,
        toc: args.toc, cover: args.cover,
        headerText: args.headerText, footerText: args.footerText,
        font: args.font, noPageNumbers: args.noPageNumbers,
        lang: args.lang, template: args.template,
      });
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(htmlPath, html, 'utf-8');
      console.log('HTML:       ' + path.basename(htmlPath));
      console.log('  Done! → ' + htmlPath);
    } catch (err) {
      console.error('  Error: ' + err.message);
      process.exit(1);
    }
    return;
  }

  if (args.serve) { startServer(args.files[0], args); return; }
  if (args.watch) { startWatchMode(args.files[0], args); return; }

  const total = args.files.length;
  let success = 0, failed = 0;

  // --merge with single file
  if (args.merge && total === 1) console.warn("Warning: --merge ignored, need at least 2 files");

  // Merge mode
  if (args.merge && total > 1) {
    console.log(`Converting ${total} files, then merging...\n`);
    const tasks = args.files.map((f, i) => async () => {
      console.log(`[${i + 1}/${total}] Converting: ${path.basename(f)}`);
      const outPath = resolveOutputPath(path.resolve(f), args);
      try { await md2pdfTh(buildCoreOptions(args, f, outPath)); console.log(`  Done! → ${outPath}`); return { success: true, outputPath: outPath }; }
      catch (err) { console.error(`  Error: ${err.message}`); return { success: false, outputPath: null }; }
    });
    const results = await runWithConcurrency(tasks, args.concurrencyLimit || CONCURRENCY_LIMIT);
    const pdfPaths = results.filter(r => r.success).map(r => r.outputPath);
    const mergeOutput = args.outDir ? path.join(path.resolve(args.outDir), "merged.pdf") : path.join(path.dirname(path.resolve(args.files[0])), "merged.pdf");
    if (pdfPaths.length > 1) {
      try {
        const buffers = await Promise.all(pdfPaths.map(p => fs.promises.readFile(p)));
        const merged = await mergePdfBuffers(buffers);
        await fs.promises.writeFile(mergeOutput, merged);
        console.log(`  Merged ${pdfPaths.length} PDFs → ${mergeOutput}`);
        success = pdfPaths.length;
      } catch (err) { console.error(`  Merge failed: ${err.message}`); failed = pdfPaths.length; }
    } else { console.error("  Error: Need at least 2 successful conversions to merge."); failed = total; }
    console.log(`\nResults: ${success} succeeded, ${failed} failed out of ${total} files`);
    process.exit(failed > 0 ? 1 : 0);
  }

  // Batch mode
  if (total > 1) {
    const limit = args.concurrencyLimit || CONCURRENCY_LIMIT;
    console.log(`Converting ${total} files with concurrency limit ${limit}...\n`);
    const tasks = args.files.map((f, i) => async () => {
      console.log(`[${i + 1}/${total}] Converting: ${path.basename(f)}`);
      const outPath = resolveOutputPath(path.resolve(f), args);
      try { await md2pdfTh(buildCoreOptions(args, f, outPath)); console.log(`  Done! → ${outPath}`); return true; }
      catch (err) { console.error(`  Error: ${err.message}`); return false; }
    });
    const results = await runWithConcurrency(tasks, limit);
    results.forEach(r => { if (r) success++; else failed++; });
    console.log(`\nResults: ${success} succeeded, ${failed} failed out of ${total} files`);
  } else {
    const inputPath = args.files[0];
    const outputPath = resolveOutputPath(path.resolve(inputPath), args);
    console.log(`Converting: ${path.basename(inputPath)}`);
    console.log(`Output:     ${path.basename(outputPath)}`);
    try { await md2pdfTh(buildCoreOptions(args, inputPath, outputPath)); console.log(`  Done! → ${outputPath}`); success++; }
    catch (err) { console.error(`  Error: ${err.message}`); failed++; }
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
