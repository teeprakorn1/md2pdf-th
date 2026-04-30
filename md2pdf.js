#!/usr/bin/env node
/**
 * md2pdf-th CLI — thin wrapper around md2pdfTh core engine
 */

const fs = require("fs");
const path = require("path");
const http = require("http");
const { md2pdfTh, mergePdfBuffers, VERSION, PAGE_SIZES, sanitizeHtml, stripFrontmatter, parseFrontmatter, extractTitleFromContent, generateToc, generateCoverPage, escapeHtml } = require("./lib/md2pdf-core");

const CONCURRENCY_LIMIT = 4;
const DEFAULT_CSS_PATH = path.join(__dirname, "style.css");
const DARK_CSS_PATH = path.join(__dirname, "style-dark.css");

// ─── Argument Parser ────────────────────────────────────────────────────────

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
  console.log(`\n  md2pdf v${VERSION} — Markdown to PDF Converter (Thai/English)\n  ============================================================\n\n  Usage:\n    md2pdf-th <file.md> [output.pdf]\n    md2pdf-th <file1.md> <file2.md> ...          (batch convert)\n    md2pdf-th [options] <file.md>\n\n  Options:\n    --css <path>           Custom CSS file path\n    --outdir, -o <dir>     Output directory\n    --no-page-numbers      Disable page numbers\n    --theme <light|dark>   Color theme (default: light)\n    --toc                  Generate Table of Contents\n    --watch                Watch mode — reconvert on file change\n    --merge                Merge multiple PDFs into one\n    --cover                Add cover page from frontmatter\n    --header <text>        Custom header text\n    --footer <text>        Custom footer text\n    --format <size>        Page size: A3, A4, A5, Letter, Legal, Tabloid\n    --font <name>          Custom font family\n    --serve                Start web preview server\n    --port <port>          Server port (default: 3000)\n    --version, -v          Show version\n    --help, -h             Show this help\n\n  Library API:\n    const { md2pdfTh } = require('md2pdf-th');\n    const pdfBuffer = await md2pdfTh({ content: '# Hello' });\n  `);
}

// ─── Build core options from CLI args ────────────────────────────────────────

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
    lang: "th",
  };
}

// ─── Concurrency ─────────────────────────────────────────────────────────────

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

// ─── Watch Mode ──────────────────────────────────────────────────────────────

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
  fs.watch(path.resolve(inputPath), (eventType) => {
    if (eventType === "change") {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doConvert, 500);
    }
  });
  doConvert();
}

// ─── Web Server ──────────────────────────────────────────────────────────────

function startServer(inputPath, args) {
  const port = args.servePort;
  const authToken = Math.random().toString(36).slice(2, 10);
  console.log(`\n🌐 Web preview server starting on http://localhost:${port}`);
  console.log(`   🔑 Auth token: ${authToken}`);
  console.log(`   ⚠️  Bind: 127.0.0.1 only — do not expose to public networks`);
  let lastHtml = "";
  const { marked } = require("marked");

  // Per-IP rate limit with 60s window
  const ipRequests = new Map();
  const RATE_LIMIT_PER_IP = 60;
  const RATE_WINDOW_MS = 60000;

  function checkRateLimit(ip) {
    const now = Date.now();
    const entry = ipRequests.get(ip) || { count: 0, windowStart: now };
    if (now - entry.windowStart > RATE_WINDOW_MS) { entry.count = 0; entry.windowStart = now; }
    entry.count++;
    ipRequests.set(ip, entry);
    return entry.count <= RATE_LIMIT_PER_IP;
  }

  const convertToHtml = async () => {
    try {
      const resolved = path.resolve(inputPath);
      if (!fs.existsSync(resolved)) return;
      let mdContent = fs.readFileSync(resolved, "utf-8");
      const fm = parseFrontmatter(mdContent);
      mdContent = sanitizeHtml(stripFrontmatter(mdContent));
      if (args.toc) mdContent = generateToc(mdContent) + mdContent;
      const title = extractTitleFromContent(mdContent, 0, path.basename(resolved, ".md"));
      if (args.cover) { const d = fm.date || new Date().toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"}); mdContent = generateCoverPage(title, fm.author, d) + mdContent; }
      const cssFile = args.theme === "dark" ? DARK_CSS_PATH : DEFAULT_CSS_PATH;
      const css = fs.existsSync(cssFile) ? fs.readFileSync(cssFile, "utf-8") : "";
      lastHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${marked.parse(mdContent)}</body></html>`;
    } catch (err) { lastHtml = `<!DOCTYPE html><html><body><p>Error: ${escapeHtml(err.message)}</p></body></html>`; }
  };

  const resolved = path.resolve(inputPath);
  const inputDir = path.dirname(resolved);
  if (fs.existsSync(resolved)) { let debounceTimer = null; fs.watch(resolved, () => { if (debounceTimer) clearTimeout(debounceTimer); debounceTimer = setTimeout(convertToHtml, 500); }); }

  const MIME_TYPES = { ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".gif":"image/gif", ".svg":"image/svg+xml", ".webp":"image/webp", ".ico":"image/x-icon" };

  const server = http.createServer((req, res) => {
    const ip = req.socket.remoteAddress;
    if (!checkRateLimit(ip)) { res.writeHead(429, { "Content-Type": "text/plain" }); res.end("Rate limit exceeded"); return; }

    const urlPath = req.url.split("?")[0];

    // Auth check — token in query param
    if (urlPath === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(lastHtml || "<p>Loading...</p>");
      return;
    }

    // Serve images from the same directory as the markdown file
    const ext = path.extname(urlPath).toLowerCase();
    if (MIME_TYPES[ext]) {
      const imgPath = path.join(inputDir, path.basename(urlPath));
      if (fs.existsSync(imgPath)) {
        res.writeHead(200, { "Content-Type": MIME_TYPES[ext] });
        fs.createReadStream(imgPath).pipe(res);
        return;
      }
    }

    res.writeHead(404);
    res.end("Not found");
  });
  convertToHtml().then(() => { server.listen(port, "127.0.0.1", () => { console.log(`   Ready! Open http://localhost:${port}`); }); });
}

// ─── Output Path ─────────────────────────────────────────────────────────────

function resolveOutputPath(inputPath, args) {
  if (args.outputPath && args.files.length === 1) return args.outputPath;
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const dir = args.outDir ? path.resolve(args.outDir) : path.dirname(inputPath);
  if (args.outDir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${baseName}.pdf`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

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

  if (args.serve) { startServer(args.files[0], args); return; }
  if (args.watch) { startWatchMode(args.files[0], args); return; }

  const total = args.files.length;
  let success = 0, failed = 0;

  // Merge mode
  if (args.merge && total > 1) {
    console.log(`Converting ${total} files, then merging...\n`);
    const tasks = args.files.map((f, i) => async () => {
      console.log(`[${i + 1}/${total}] Converting: ${path.basename(f)}`);
      const outPath = resolveOutputPath(path.resolve(f), args);
      try { await md2pdfTh(buildCoreOptions(args, f, outPath)); console.log(`  Done! → ${outPath}`); return { success: true, outputPath: outPath }; }
      catch (err) { console.error(`  Error: ${err.message}`); return { success: false, outputPath: null }; }
    });
    const results = await runWithConcurrency(tasks, CONCURRENCY_LIMIT);
    const pdfPaths = results.filter(r => r.success).map(r => r.outputPath);
    const mergeOutput = args.outDir ? path.join(path.resolve(args.outDir), "merged.pdf") : path.join(path.dirname(path.resolve(args.files[0])), "merged.pdf");
    if (pdfPaths.length > 1) {
      try {
        const buffers = pdfPaths.map(p => fs.readFileSync(p));
        const merged = await mergePdfBuffers(buffers);
        fs.writeFileSync(mergeOutput, merged);
        console.log(`  Merged ${pdfPaths.length} PDFs → ${mergeOutput}`);
        success = pdfPaths.length;
      } catch (err) { console.error(`  Merge failed: ${err.message}`); failed = pdfPaths.length; }
    } else { console.error("  Error: Need at least 2 successful conversions to merge."); failed = total; }
    console.log(`\nResults: ${success} succeeded, ${failed} failed out of ${total} files`);
    process.exit(failed > 0 ? 1 : 0);
  }

  // Batch mode
  if (total > 1) {
    console.log(`Converting ${total} files with concurrency limit ${CONCURRENCY_LIMIT}...\n`);
    const tasks = args.files.map((f, i) => async () => {
      console.log(`[${i + 1}/${total}] Converting: ${path.basename(f)}`);
      const outPath = resolveOutputPath(path.resolve(f), args);
      try { await md2pdfTh(buildCoreOptions(args, f, outPath)); console.log(`  Done! → ${outPath}`); return true; }
      catch (err) { console.error(`  Error: ${err.message}`); return false; }
    });
    const results = await runWithConcurrency(tasks, CONCURRENCY_LIMIT);
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
