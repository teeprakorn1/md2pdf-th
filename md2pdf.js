#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { mdToPdf } = require("md-to-pdf");

const VERSION = "1.0.0";
const CONCURRENCY_LIMIT = 4;
const DEFAULT_CSS_PATH = path.join(__dirname, "style.css");
const PAGE_HEADER_TEMPLATE = `
<div style="font-size:8px; width:100%; text-align:center; color:#94a3b8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%;">
  <span class="title"></span>
</div>`;
const PAGE_FOOTER_TEMPLATE = `
<div style="font-size:9px; width:100%; text-align:center; color:#94a3b8;">
  <span class="pageNumber"></span> / <span class="totalPages"></span>
</div>`;

function parseArgs(argv) {
  const args = { files: [], cssPath: null, outDir: null, noPageNumbers: false };
  const rest = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
      case "-h":
        args.help = true;
        break;
      case "--version":
      case "-v":
        args.version = true;
        break;
      case "--css":
        args.cssPath = argv[++i];
        if (!args.cssPath || args.cssPath.startsWith("-")) {
          console.error("Error: --css requires a path argument");
          args.error = true;
          args.cssPath = null;
        }
        break;
      case "--outdir":
      case "-o":
        args.outDir = argv[++i];
        if (!args.outDir || args.outDir.startsWith("-")) {
          console.error("Error: --outdir requires a directory argument");
          args.error = true;
          args.outDir = null;
        }
        break;
      case "--no-page-numbers":
        args.noPageNumbers = true;
        break;
      default:
        if (arg.startsWith("-")) {
          console.error(`Unknown option: ${arg}`);
          args.error = true;
        } else {
          rest.push(arg);
        }
        break;
    }
  }

  if (rest.length === 2 && !rest[1].endsWith(".md")) {
    args.files.push(rest[0]);
    args.outputPath = path.resolve(rest[1]);
  } else {
    args.files.push(...rest);
  }

  return args;
}

function printUsage() {
  console.log(`
  md2pdf v${VERSION} — Markdown to PDF Converter
  ==============================================

  Usage:
    node md2pdf.js <file.md> [output.pdf]
    node md2pdf.js <file1.md> <file2.md> ...     (batch convert)
    node md2pdf.js [options] <file.md>

  Options:
    --css <path>         Custom CSS file path
    --outdir, -o <dir>   Output directory (default: same as input)
    --no-page-numbers    Disable page numbers
    --version, -v        Show version
    --help, -h           Show this help

  Examples:
    node md2pdf.js doc.md
    node md2pdf.js doc.md output.pdf
    node md2pdf.js doc1.md doc2.md doc3.md
    node md2pdf.js --css dark.css doc.md
    node md2pdf.js -o ./pdfs *.md
  `);
}

function sanitizeHtml(content) {
  // Strip dangerous HTML tags and event handlers
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^>]*>[^<]*<\/embed>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+on\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\s+on\w+\s*=\s*[^\s>]+/gi, "");
}

function extractTitle(filePath, maxLen = 0) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return processTitle(content, maxLen, path.basename(filePath, ".md"));
  } catch (err) {
    console.error(`  Warning: Failed to read file for title: ${err.message}`);
    return path.basename(filePath, ".md");
  }
}

function extractTitleFromContent(content, maxLen = 0, fallback) {
  return processTitle(content, maxLen, fallback || "Untitled");
}

function processTitle(content, maxLen, fallback) {
  const match = content.match(/^#\s+(.+)$/m);
  let title = match
    ? match[1].replace(/[*_`~]/g, "").replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").replace(/\s+/g, " ").trim()
    : fallback;
  if (maxLen > 0 && title.length > maxLen) {
    title = title.slice(0, maxLen - 1) + "…";
  }
  return title;
}

function resolveOutputPath(inputPath, options) {
  if (options.outputPath && options.files.length === 1) {
    return options.outputPath;
  }
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const dir = options.outDir ? path.resolve(options.outDir) : path.dirname(inputPath);
  if (options.outDir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, `${baseName}.pdf`);
}

async function convertFile(inputPath, options) {
  const resolvedInput = path.resolve(inputPath);

  if (!fs.existsSync(resolvedInput)) {
    console.error(`  Error: File not found: ${inputPath}`);
    return false;
  }

  if (!resolvedInput.toLowerCase().endsWith(".md")) {
    console.error(`  Error: Not a .md file: ${inputPath}`);
    return false;
  }

  const outputPath = resolveOutputPath(resolvedInput, options);
  const cssFile = options.cssPath || DEFAULT_CSS_PATH;
  const css = fs.existsSync(cssFile) ? fs.readFileSync(cssFile, "utf-8") : "";

  // Read file content once and sanitize
  let mdContent;
  try {
    mdContent = fs.readFileSync(resolvedInput, "utf-8");
  } catch (err) {
    console.error(`  Error: Failed to read file: ${err.message}`);
    return false;
  }

  const baseName = path.basename(resolvedInput, ".md");
  const title = extractTitleFromContent(mdContent, 0, baseName);
  const headerTitle = extractTitleFromContent(mdContent, 60, baseName);
  const sanitizedContent = sanitizeHtml(mdContent);

  const pdfMeta = `<script>document.title = ${JSON.stringify(headerTitle)};</script>`;
  const pdfAuthor = "md2pdf-th";
  const pdfSubject = `Markdown document converted to PDF`;
  const pdfKeywords = "markdown, pdf";

  const headerTemplate = options.noPageNumbers ? "" : PAGE_HEADER_TEMPLATE;
  const footerTemplate = options.noPageNumbers ? "" : PAGE_FOOTER_TEMPLATE;

  const marginConfig = options.noPageNumbers
    ? { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" }
    : { top: "25mm", bottom: "25mm", left: "15mm", right: "15mm" };

  try {
    const pdf = await mdToPdf(
      { content: sanitizedContent },
      {
        dest: outputPath,
        css,
        document_title: headerTitle,
        launch_options: {
          args: ["--font-render-hinting=medium"],
        },
        pdf_options: {
          format: "A4",
          margin: marginConfig,
          printBackground: true,
          displayHeaderFooter: !options.noPageNumbers,
          headerTemplate,
          footerTemplate,
          preferCSSPageSize: false,
        },
        body: pdfMeta,
      }
    );

    // Add PDF metadata if PDF was generated
    if (pdf && fs.existsSync(outputPath)) {
      try {
        const existingPdf = fs.readFileSync(outputPath);
        const modifiedPdf = addPdfMetadata(existingPdf, {
          Title: headerTitle,
          Author: pdfAuthor,
          Subject: pdfSubject,
          Keywords: pdfKeywords,
          Creator: `md2pdf-th v${VERSION}`,
        });
        fs.writeFileSync(outputPath, modifiedPdf);
      } catch (metaErr) {
        // Metadata is non-critical, continue even if it fails
        console.warn(`  Warning: Could not add PDF metadata: ${metaErr.message}`);
      }
    }

    return !!pdf;
  } catch (error) {
    console.error(`  Error: ${error.message}`);
    return false;
  }
}

// Simple PDF metadata injector
function addPdfMetadata(pdfBuffer, metadata) {
  let pdfString = pdfBuffer.toString("binary");
  const info = [];

  if (metadata.Title) info.push(`/Title (${escapePdfString(metadata.Title)})`);
  if (metadata.Author) info.push(`/Author (${escapePdfString(metadata.Author)})`);
  if (metadata.Subject) info.push(`/Subject (${escapePdfString(metadata.Subject)})`);
  if (metadata.Keywords) info.push(`/Keywords (${escapePdfString(metadata.Keywords)})`);
  if (metadata.Creator) info.push(`/Creator (${escapePdfString(metadata.Creator)})`);
  info.push(`/Producer (md2pdf-th)`);
  info.push(`/CreationDate (D:${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)})`);

  const infoDict = `<<\n${info.join("\n")}\n>>`;

  // Find a good insertion point (after the PDF header, before the first object)
  const xrefMatch = pdfString.match(/\/XRef\s*\[?/);
  if (xrefMatch) {
    // Simple approach: inject as object before xref
    const infoObj = `\n1 0 obj\n${infoDict}\nendobj\n`;
    const rootMatch = pdfString.match(/\/Root\s*(\d+)\s+(\d+)\s+R/);
    if (rootMatch) {
      pdfString = pdfString.replace(
        /\/Root\s*(\d+)\s+(\d+)\s+R/,
        `/Info 1 0 R\n/Root ${rootMatch[1]} ${rootMatch[2]} R`
      );
    }
    return Buffer.from(pdfString.slice(0, xrefMatch.index) + infoObj + pdfString.slice(xrefMatch.index), "binary");
  }

  return pdfBuffer;
}

function escapePdfString(str) {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\n/g, "\\n");
}

async function runWithConcurrency(tasks, limit) {
  const results = [];
  const executing = [];

  for (const task of tasks) {
    const promise = task().then(result => ({ result, index: results.length }));
    results.push(promise);

    const executingPromise = promise.then(() => {
      executing.splice(executing.indexOf(executingPromise), 1);
    });
    executing.push(executingPromise);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results).then(res => res.map(r => r.result));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.error) {
    printUsage();
    process.exit(1);
  }

  if (options.help) {
    printUsage();
    process.exit(0);
  }

  if (options.version) {
    console.log(`md2pdf v${VERSION}`);
    process.exit(0);
  }

  if (options.files.length === 0) {
    console.error("Error: No input file specified. Use --help for usage.");
    process.exit(1);
  }

  const total = options.files.length;
  let success = 0;
  let failed = 0;

  // Parallel processing with concurrency limit
  if (total > 1) {
    console.log(`Converting ${total} files with concurrency limit ${CONCURRENCY_LIMIT}...\n`);

    const tasks = options.files.map((inputPath, index) => async () => {
      const outputPath = resolveOutputPath(path.resolve(inputPath), options);
      console.log(`[${index + 1}/${total}] Converting: ${path.basename(inputPath)}`);

      const result = await convertFile(inputPath, options);
      if (result) {
        console.log(`  Done! → ${outputPath}`);
      }
      return { result, index };
    });

    const results = await runWithConcurrency(tasks, CONCURRENCY_LIMIT);

    results.forEach(({ result }) => {
      if (result) success++;
      else failed++;
    });

    console.log(`\nResults: ${success} succeeded, ${failed} failed out of ${total} files`);
  } else {
    const inputPath = options.files[0];
    const outputPath = resolveOutputPath(path.resolve(inputPath), options);

    console.log(`Converting: ${path.basename(inputPath)}`);
    console.log(`Output:     ${path.basename(outputPath)}`);

    const result = await convertFile(inputPath, options);
    if (result) {
      console.log(`  Done! → ${outputPath}`);
      success++;
    } else {
      failed++;
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
