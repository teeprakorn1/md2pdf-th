#!/usr/bin/env node
/**
 * Unit tests for md2pdf-th core functions (no Puppeteer required)
 * Run: node test/unit.test.js
 */

const {
  sanitizeHtml, escapeHtml, extractTitleFromContent,
  generateToc, generateCoverPage, parseFrontmatter,
  stripFrontmatter, resolveOutputFilename, friendlyError, VERSION, PAGE_SIZES,
  detectThaiContent, getFontStack, addPdfMetadata, addWatermark,
} = require("../lib/md2pdf-core");
const { PDFDocument } = require("pdf-lib");
const path = require("path");

async function makeTestPdf() {
  const doc = await PDFDocument.create();
  doc.addPage();
  return Buffer.from(await doc.save());
}

const tests = [];
let passed = 0, failed = 0;
function test(name, fn) { tests.push({ name, fn }); }

async function runTests() {
  console.log(`Running ${tests.length} unit tests...\n`);
  for (const { name, fn } of tests) {
    try { await fn(); console.log(`✅ ${name}`); passed++; }
    catch (err) { console.error(`❌ ${name}: ${err.message}`); failed++; }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// sanitizeHtml
test("sanitizeHtml strips <script>", () => {
  const result = sanitizeHtml('<script>alert("xss")</script>Hello');
  if (result.includes("<script>")) throw new Error("script not stripped");
  if (!result.includes("Hello")) throw new Error("content removed");
});

test("sanitizeHtml strips <svg>", () => {
  const result = sanitizeHtml('<svg onload="alert(1)"><rect/></svg>Hello');
  if (result.includes("<svg")) throw new Error("svg not stripped");
});

test("sanitizeHtml strips <style>", () => {
  const result = sanitizeHtml('<style>body{display:none}</style>Hello');
  if (result.includes("<style>")) throw new Error("style not stripped");
});

test("sanitizeHtml strips event handlers", () => {
  const result = sanitizeHtml('<div onclick="alert(1)">Hi</div>');
  if (result.includes("onclick")) throw new Error("onclick not stripped");
});

test("sanitizeHtml strips javascript: protocol", () => {
  const result = sanitizeHtml('<a href="javascript:alert(1)">link</a>');
  if (result.includes("javascript:")) throw new Error("javascript: not stripped");
});

test("sanitizeHtml strips <iframe>", () => {
  const result = sanitizeHtml('<iframe src="evil.com"></iframe>Safe');
  if (result.includes("<iframe")) throw new Error("iframe not stripped");
});

// escapeHtml
test("escapeHtml escapes & < > \" ' /", () => {
  const result = escapeHtml('a&b<c>d"e\'f/g');
  if (result !== "a&amp;b&lt;c&gt;d&quot;e&#39;f&#x2F;g") throw new Error(`Wrong: ${result}`);
});

// extractTitleFromContent
test("extractTitleFromContent gets h1", () => {
  const result = extractTitleFromContent("# Hello World\nSome text", 0, "fallback");
  if (result !== "Hello World") throw new Error(`Got: ${result}`);
});

test("extractTitleFromContent truncates with maxLen", () => {
  const result = extractTitleFromContent("# A very long title here", 10, "fallback");
  if (result.length > 10) throw new Error(`Not truncated: ${result}`);
  if (!result.endsWith("…")) throw new Error("No ellipsis");
});

test("extractTitleFromContent uses fallback if no h1", () => {
  const result = extractTitleFromContent("No heading here", 0, "MyDoc");
  if (result !== "MyDoc") throw new Error(`Got: ${result}`);
});

// parseFrontmatter
test("parseFrontmatter extracts title, author, date", () => {
  const content = "---\ntitle: My Title\nauthor: John\ndate: 2024-01-01\n---\nContent";
  const meta = parseFrontmatter(content);
  if (meta.title !== "My Title") throw new Error(`title: ${meta.title}`);
  if (meta.author !== "John") throw new Error(`author: ${meta.author}`);
  if (meta.date !== "2024-01-01") throw new Error(`date: ${meta.date}`);
});

test("parseFrontmatter extracts tags", () => {
  const content = "---\ntags: foo, bar, baz\n---\nContent";
  const meta = parseFrontmatter(content);
  if (meta.tags.length !== 3) throw new Error(`tags: ${meta.tags}`);
});

test("parseFrontmatter returns empty for no frontmatter", () => {
  const meta = parseFrontmatter("Just content");
  if (meta.title !== "") throw new Error("Should be empty");
});

test("parseFrontmatter handles quoted values", () => {
  const content = '---\ntitle: "My Title"\nauthor: \'John\'\n---\nContent';
  const meta = parseFrontmatter(content);
  if (meta.title !== "My Title") throw new Error(`title: ${meta.title}`);
  if (meta.author !== "John") throw new Error(`author: ${meta.author}`);
});

test("parseFrontmatter handles block scalar |", () => {
  const content = "---\ndescription: |\n  Line 1\n  Line 2\n---\nContent";
  const meta = parseFrontmatter(content);
  if (!meta.description.includes("Line 1")) throw new Error(`desc: ${meta.description}`);
});

// Regression: frontmatter boolean YAML spec (yes/on/1)
test("parseFrontmatter handles boolean yes/on/1", () => {
  const meta = parseFrontmatter("---\ntoc: yes\ncover: on\nnoPageNumbers: 1\n---\n");
  if (meta.toc !== true) throw new Error("toc should be true");
  if (meta.cover !== true) throw new Error("cover should be true");
  if (meta.noPageNumbers !== true) throw new Error("noPageNumbers should be true");
});

// Regression: inner quotes preserved (O'Brien)
test("parseFrontmatter preserves inner quotes", () => {
  const meta = parseFrontmatter("---\nauthor: O'Brien\n---\n");
  if (meta.author !== "O'Brien") throw new Error(`author: ${meta.author}`);
});

// Regression: frontmatter empty theme distinguished from missing
test("parseFrontmatter respects explicit empty theme via 'in' operator merge", () => {
  const meta = parseFrontmatter("---\ntheme: ''\n---\n");
  // meta.theme should be "" (empty string), not missing
  if (!("theme" in meta)) throw new Error("theme should be present");
});

// stripFrontmatter
test("stripFrontmatter removes frontmatter", () => {
  const result = stripFrontmatter("---\ntitle: Test\n---\n# Hello");
  if (result.startsWith("---")) throw new Error("Frontmatter not stripped");
  if (!result.includes("# Hello")) throw new Error("Content removed");
});

// generateToc 
test("generateToc creates TOC from headings", () => {
  const content = "# Title\n## Section 1\n### Sub 1.1\n## Section 2";
  const toc = generateToc(content);
  if (!toc.includes("Table of Contents")) throw new Error("No TOC header");
  if (!toc.includes("Section 1")) throw new Error("Missing heading");
});

test("generateToc returns empty for no headings", () => {
  const toc = generateToc("Just some text\nNo headings");
  if (toc !== "") throw new Error("Should be empty");
});

test("generateToc deduplicates identical heading ids", () => {
  const content = "## Intro\nSome text\n## Intro\nMore text";
  const toc = generateToc(content);
  if (!toc.includes("intro-1")) throw new Error("Duplicate id not deduplicated");
});

// Regression: TOC slug uses marked/github-slugger algorithm
test("generateToc slug strips punctuation and lowercases", () => {
  const content = "## Hello World!!!\n## Foo & Bar\n### ทดสอบ 123";
  const toc = generateToc(content);
  if (!toc.includes("hello-world")) throw new Error("slug mismatch for hello-world");
  if (!toc.includes("foo-bar")) throw new Error("slug mismatch for foo-bar");
  if (!toc.includes("ทดสอบ-123")) throw new Error("slug mismatch for thai");
});

// generateCoverPage
test("generateCoverPage escapes HTML in title", () => {
  const cover = generateCoverPage("<script>alert(1)</script>", "Author", "Date");
  if (cover.includes("<script>")) throw new Error("XSS not escaped in cover");
  if (!cover.includes("&lt;script")) throw new Error("Script tag not escaped");
});

test("generateCoverPage includes author when provided", () => {
  const cover = generateCoverPage("Title", "John", "Date");
  if (!cover.includes("cover-author")) throw new Error("No author div");
});

test("generateCoverPage omits author when empty", () => {
  const cover = generateCoverPage("Title", "", "Date");
  if (cover.includes("cover-author")) throw new Error("Author div should be omitted");
});

// VERSION & PAGE_SIZES
test("VERSION is non-empty string", () => {
  if (typeof VERSION !== "string" || !VERSION.match(/^\d+\.\d+\.\d+$/)) throw new Error(`Bad version: ${VERSION}`);
});

test("PAGE_SIZES contains A4 and Letter", () => {
  if (!PAGE_SIZES.includes("A4")) throw new Error("Missing A4");
  if (!PAGE_SIZES.includes("Letter")) throw new Error("Missing Letter");
});

// friendlyError
test("friendlyError handles null/undefined without throwing", () => {
  const r1 = friendlyError(null);
  if (typeof r1 !== "string") throw new Error("Should return string for null");
  const r2 = friendlyError(undefined);
  if (typeof r2 !== "string") throw new Error("Should return string for undefined");
});

// extractTitleFromContent emoji
test("extractTitleFromContent preserves emoji", () => {
  const result = extractTitleFromContent("# Hello 🌍", 0, "fallback");
  if (!result.includes("🌍")) throw new Error("Emoji stripped incorrectly: " + result);
});

test("extractTitleFromContent truncates unicode correctly", () => {
  const result = extractTitleFromContent("# Hello 🌍 world test", 8, "fallback");
  if ([...result].length > 8) throw new Error("Unicode length truncation failed");
});

// resolveOutputFilename
test("resolveOutputFilename replaces all patterns", () => {
  const result = resolveOutputFilename("{name}-{date}-{time}-{timestamp}", "doc");
  if (result.includes("{name}")) throw new Error("name not replaced");
  if (result.includes("{date}")) throw new Error("date not replaced");
  if (result.includes("{time}")) throw new Error("time not replaced");
  if (result.includes("{timestamp}")) throw new Error("timestamp not replaced");
});

// _explicitKeys tracks frontmatter keys
test("parseFrontmatter _explicitKeys tracks only parsed keys", () => {
  const meta = parseFrontmatter("---\ntitle: Hello\ntheme: dark\n---\n");
  if (!meta._explicitKeys.has("title")) throw new Error("title should be explicit");
  if (!meta._explicitKeys.has("theme")) throw new Error("theme should be explicit");
  if (meta._explicitKeys.has("toc")) throw new Error("toc should not be explicit");
  if (meta._explicitKeys.has("cover")) throw new Error("cover should not be explicit");
  if (meta._explicitKeys.has("watermark")) throw new Error("watermark should not be explicit");
});

test("parseFrontmatter without frontmatter has empty _explicitKeys", () => {
  const meta = parseFrontmatter("Just content");
  if (meta._explicitKeys.size !== 0) throw new Error("Should have no explicit keys");
});

// sanitizeHtml strips unclosed tags
test("sanitizeHtml strips unclosed <script> tag", () => {
  const result = sanitizeHtml('<script>alert(1)');
  if (result.includes("<script>")) throw new Error("unclosed script not stripped");
});

test("sanitizeHtml strips orphan </script> closing tag", () => {
  const result = sanitizeHtml('Hello</script>World');
  if (result.includes("</script>")) throw new Error("orphan closing script not stripped");
});

test("sanitizeHtml strips unclosed <svg> tag", () => {
  const result = sanitizeHtml('<svg onload=alert(1)>');
  if (result.includes("<svg")) throw new Error("unclosed svg not stripped");
});

// parseFrontmatter handles EOF without trailing newline
test("parseFrontmatter handles frontmatter at EOF without trailing newline", () => {
  const meta = parseFrontmatter("---\ntitle: NoNewline\n---");
  if (meta.title !== "NoNewline") throw new Error(`title: ${meta.title}`);
});

//Regression: stripFrontmatter synced with parseFrontmatter
test("stripFrontmatter handles EOF without trailing newline", () => {
  const result = stripFrontmatter("---\ntitle: Test\n---");
  if (result.includes("---")) throw new Error("Frontmatter not stripped at EOF");
});

// _parseFmValue matches same quote type

test("parseFrontmatter handles mismatched inner quotes correctly", () => {
  const meta = parseFrontmatter("---\ntitle: \"He said 'hello'\"\n---\n");
  if (meta.title !== "He said 'hello'") throw new Error(`title: ${meta.title}`);
});

// detectThaiContent null guard
test("detectThaiContent returns 0 for null/undefined/empty", () => {
  const { detectThaiContent } = require("../lib/md2pdf-core");
  if (detectThaiContent(null) !== 0) throw new Error("null should return 0");
  if (detectThaiContent(undefined) !== 0) throw new Error("undefined should return 0");
  if (detectThaiContent("") !== 0) throw new Error("empty should return 0");
});

// sanitizeHtml strips <form>
test("sanitizeHtml strips <form>", () => {
  const result = sanitizeHtml('<form action="evil"><input></form>Safe');
  if (result.includes("<form")) throw new Error("form not stripped");
});

test("sanitizeHtml strips <base>", () => {
  const result = sanitizeHtml('<base href="https://evil.com/">Hello');
  if (result.includes("<base")) throw new Error("base not stripped");
});

test("sanitizeHtml strips <link>", () => {
  const result = sanitizeHtml('<link rel="stylesheet" href="evil.css">Hello');
  if (result.includes("<link")) throw new Error("link not stripped");
});

test("sanitizeHtml strips <meta http-equiv>", () => {
  const result = sanitizeHtml('<meta http-equiv="refresh" content="0;url=evil">Hello');
  if (result.includes("<meta")) throw new Error("meta not stripped");
});

test("sanitizeHtml blocks data:image/svg+xml", () => {
  const result = sanitizeHtml('<img src="data:image/svg+xml,<svg onload=alert(1)>">Hello');
  if (result.includes("data:image/svg+xml")) throw new Error("data:image/svg+xml not blocked");
});

test("sanitizeHtml strips backtick event handler", () => {
  const result = sanitizeHtml('<div onclick=`alert(1)`>Hi</div>');
  if (result.includes("onclick")) throw new Error("backtick onclick not stripped");
});

// detectThaiContent
test("detectThaiContent returns ~1.0 for pure Thai", () => {
  const ratio = detectThaiContent("สวัสดีครับ");
  if (ratio < 0.9) throw new Error(`Expected ~1.0, got ${ratio}`);
});

test("detectThaiContent returns ~0.5 for mixed", () => {
  const ratio = detectThaiContent("Hello สวัสดี");
  if (ratio < 0.2 || ratio > 0.8) throw new Error(`Expected ~0.5, got ${ratio}`);
});

// getFontStack 
test("getFontStack returns Thai fonts for lang=th", () => {
  const stack = getFontStack("th", "Hello", null);
  if (!stack.includes("Leelawadee")) throw new Error("Missing Thai font");
});

test("getFontStack returns English fonts for lang=en no Thai", () => {
  const stack = getFontStack("en", "Hello World", null);
  if (!stack.includes("Segoe UI")) throw new Error("Missing English font");
});

test("getFontStack injects custom font first", () => {
  const stack = getFontStack("th", "Hello", "Georgia");
  if (!stack.startsWith("'Georgia'")) throw new Error(`Custom font not first: ${stack}`);
});

// addPdfMetadata
test("addPdfMetadata sets Title and Author", async () => {
  const pdf = await makeTestPdf();
  const result = await addPdfMetadata(pdf, { Title: "Test Title", Author: "Test Author" });
  const doc = await PDFDocument.load(result);
  if (doc.getTitle() !== "Test Title") throw new Error(`Title: ${doc.getTitle()}`);
  if (doc.getAuthor() !== "Test Author") throw new Error(`Author: ${doc.getAuthor()}`);
});

// addWatermark
test("addWatermark adds watermark to PDF", async () => {
  const pdf = await makeTestPdf();
  const result = await addWatermark(pdf, "DRAFT");
  if (!Buffer.isBuffer(Buffer.from(result))) throw new Error("Not a valid PDF buffer");
  if (result.length <= pdf.length) throw new Error("Watermarked PDF should be larger");
});

test("addWatermark skips Thai text gracefully", async () => {
  const pdf = await makeTestPdf();
  const result = await addWatermark(pdf, "ลับ");
  if (result.length !== pdf.length) throw new Error("Thai watermark should return original");
});

// parseArgs — accepts values starting with dash (C5 fix)
test("CLI --header accepts value starting with dash", () => {
  const { execSync } = require("child_process");
  try {
    const output = execSync('node md2pdf.js --header "-Section-" --help', { encoding: "utf-8", cwd: path.join(__dirname, "..") });
    if (output.includes("Error: --header")) throw new Error("--header rejected dash value");
  } catch (err) {
    if (err.stderr && err.stderr.includes("Error: --header")) throw new Error("--header rejected dash value");
  }
});

test("CLI --watermark accepts value starting with dash", () => {
  const { execSync } = require("child_process");
  try {
    const output = execSync('node md2pdf.js --watermark "-DRAFT-" --help', { encoding: "utf-8", cwd: path.join(__dirname, "..") });
    if (output.includes("Error: --watermark")) throw new Error("--watermark rejected dash value");
  } catch (err) {
    if (err.stderr && err.stderr.includes("Error: --watermark")) throw new Error("--watermark rejected dash value");
  }
});

test("CLI --css without value shows error", () => {
  const { execSync } = require("child_process");
  try {
    execSync('node md2pdf.js --css', { encoding: "utf-8", cwd: path.join(__dirname, ".."), stdio: "pipe" });
    throw new Error("Should have exited with error");
  } catch (err) {
    if (!err.stderr || !err.stderr.includes("Error:")) throw new Error("Missing error for --css without value");
  }
});

runTests();
