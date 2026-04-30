#!/usr/bin/env node
/**
 * Unit tests for md2pdf-th core functions (no Puppeteer required)
 * Run: node test/unit.test.js
 */

const {
  sanitizeHtml, escapeHtml, extractTitleFromContent,
  generateToc, generateCoverPage, parseFrontmatter,
  stripFrontmatter, VERSION, PAGE_SIZES,
} = require("../lib/md2pdf-core");

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

// ─── sanitizeHtml ────────────────────────────────────────────────────────────

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

// ─── escapeHtml ──────────────────────────────────────────────────────────────

test("escapeHtml escapes & < > \" '", () => {
  const result = escapeHtml('a&b<c>d"e\'f');
  if (result !== "a&amp;b&lt;c&gt;d&quot;e&#39;f") throw new Error(`Wrong: ${result}`);
});

// ─── extractTitleFromContent ─────────────────────────────────────────────────

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

// ─── parseFrontmatter ────────────────────────────────────────────────────────

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

// ─── stripFrontmatter ────────────────────────────────────────────────────────

test("stripFrontmatter removes frontmatter", () => {
  const result = stripFrontmatter("---\ntitle: Test\n---\n# Hello");
  if (result.startsWith("---")) throw new Error("Frontmatter not stripped");
  if (!result.includes("# Hello")) throw new Error("Content removed");
});

// ─── generateToc ─────────────────────────────────────────────────────────────

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

// ─── generateCoverPage ───────────────────────────────────────────────────────

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

// ─── VERSION & PAGE_SIZES ────────────────────────────────────────────────────

test("VERSION is non-empty string", () => {
  if (typeof VERSION !== "string" || !VERSION.match(/^\d+\.\d+\.\d+$/)) throw new Error(`Bad version: ${VERSION}`);
});

test("PAGE_SIZES contains A4 and Letter", () => {
  if (!PAGE_SIZES.includes("A4")) throw new Error("Missing A4");
  if (!PAGE_SIZES.includes("Letter")) throw new Error("Missing Letter");
});

runTests();
