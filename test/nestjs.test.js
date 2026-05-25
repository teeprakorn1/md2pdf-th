#!/usr/bin/env node
/**
 * NestJS module and service unit tests (mocked core — no Puppeteer required)
 * Run: node test/nestjs.test.js
 */

const tests = [];
let passed = 0, failed = 0;

function test(name, fn) { tests.push({ name, fn }); }

// Mock md2pdfTh before requiring NestJS modules
let lastCallOpts = null;
const core = require("../lib/md2pdf-core");
const originalMd2pdfTh = core.md2pdfTh;
core.md2pdfTh = async (opts) => { lastCallOpts = opts; return Buffer.from("mock-pdf"); };

const { Md2PdfService } = require("../lib/nestjs/md2pdf.service");
const { Md2PdfModule } = require("../lib/nestjs/md2pdf.module");

// Md2PdfService
test("Md2PdfService constructor sets defaults", () => {
  const svc = new Md2PdfService({ theme: "dark" });
  if (svc._defaults.theme !== "dark") throw new Error("defaults not set");
});

test("Md2PdfService._merge combines defaults + options", () => {
  const svc = new Md2PdfService({ theme: "dark", format: "A4" });
  const merged = svc._merge({ format: "Letter" });
  if (merged.theme !== "dark") throw new Error("default not preserved");
  if (merged.format !== "Letter") throw new Error("option not overriding");
});

test("Md2PdfService.convertFromContent passes content correctly", async () => {
  lastCallOpts = null;
  const svc = new Md2PdfService({ theme: "light" });
  await svc.convertFromContent("# Hello", { format: "A4" });
  if (lastCallOpts.content !== "# Hello") throw new Error(`content: ${lastCallOpts.content}`);
  if (lastCallOpts.theme !== "light") throw new Error("default not merged");
  if (lastCallOpts.format !== "A4") throw new Error("option not merged");
});

test("Md2PdfService.convertFromContent content not overridden by options (BUG-13)", async () => {
  lastCallOpts = null;
  const svc = new Md2PdfService();
  await svc.convertFromContent("# Real", { content: "# Fake" });
  if (lastCallOpts.content !== "# Real") throw new Error(`content should be '# Real', got: ${lastCallOpts.content}`);
});

test("Md2PdfService.getVersion returns valid semver", () => {
  const svc = new Md2PdfService();
  const ver = svc.getVersion();
  if (!ver.match(/^\d+\.\d+\.\d+$/)) throw new Error(`Bad version: ${ver}`);
});

// Md2PdfModule
test("Md2PdfModule.forRoot returns correct shape", () => {
  const config = Md2PdfModule.forRoot({ theme: "dark" });
  if (!config.module) throw new Error("missing module");
  if (!config.providers || !Array.isArray(config.providers)) throw new Error("missing providers");
  if (!config.exports || !Array.isArray(config.exports)) throw new Error("missing exports");
  if (config.global !== true) throw new Error("should be global");
});

test("Md2PdfModule.forRoot providers include Md2PdfService", () => {
  const config = Md2PdfModule.forRoot();
  const hasService = config.providers.some(p => p === Md2PdfService || (p && p.provide === Md2PdfService));
  const hasExport = config.exports.some(e => e === Md2PdfService);
  if (!hasService) throw new Error("Md2PdfService not in providers");
  if (!hasExport) throw new Error("Md2PdfService not in exports");
});

test("Md2PdfModule.forRootAsync returns correct shape", () => {
  const config = Md2PdfModule.forRootAsync({
    useFactory: () => ({ theme: "dark" }),
    inject: [],
  });
  if (!config.module) throw new Error("missing module");
  if (!config.providers || !Array.isArray(config.providers)) throw new Error("missing providers");
  if (config.global !== true) throw new Error("should be global");
});

// Run
async function runTests() {
  console.log(`Running ${tests.length} NestJS tests...\n`);
  for (const { name, fn } of tests) {
    try { await fn(); console.log(`✅ ${name}`); passed++; }
    catch (err) { console.error(`❌ ${name}: ${err.message}`); failed++; }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  // Restore original
  core.md2pdfTh = originalMd2pdfTh;
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
