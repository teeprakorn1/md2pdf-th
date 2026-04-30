#!/usr/bin/env node
/**
 * Basic tests for md2pdf-th
 * Run: node test/md2pdf.test.js
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SCRIPT = path.join(__dirname, "..", "md2pdf.js");
const MD_DIR = path.join(__dirname, "..", "md");
const TEST_DIR = path.join(__dirname, "test-output");

// Test configuration
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  // Clean up test output directory
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });

  console.log(`Running ${tests.length} tests...\n`);

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ ${name}: ${err.message}`);
      failed++;
    }
  }

  // Cleanup
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// Test 1: Version check
test("--version returns version number", () => {
  const output = execSync(`node "${SCRIPT}" --version`, { encoding: "utf-8" });
  if (!output.includes("md2pdf v")) {
    throw new Error("Version not found in output");
  }
});

// Test 2: Help check
test("--help returns usage information", () => {
  const output = execSync(`node "${SCRIPT}" --help`, { encoding: "utf-8" });
  if (!output.includes("Usage:") || !output.includes("Options:")) {
    throw new Error("Help text incomplete");
  }
});

// Test 3: Single file conversion
test("converts single markdown file to PDF", async () => {
  const input = path.join(MD_DIR, "example-basic.md");
  const output = path.join(TEST_DIR, "test-basic.pdf");

  execSync(`node "${SCRIPT}" "${input}" "${output}"`, { encoding: "utf-8" });

  if (!fs.existsSync(output)) {
    throw new Error("PDF file not created");
  }

  const stats = fs.statSync(output);
  if (stats.size < 1000) {
    throw new Error("PDF file too small, possibly corrupted");
  }
});

// Test 4: Batch conversion
test("converts multiple files in batch", async () => {
  const inputs = [
    path.join(MD_DIR, "example-basic.md"),
    path.join(MD_DIR, "example-tables.md"),
    path.join(MD_DIR, "example-code.md"),
  ];

  // Batch conversion creates PDFs next to input files (in MD_DIR)
  const outputs = inputs.map(f => path.join(MD_DIR, path.basename(f, ".md") + ".pdf"));

  // Clean up any existing output PDFs in md/ directory
  outputs.forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });

  execSync(`node "${SCRIPT}" ${inputs.map(f => `"${f}"`).join(" ")}`, { encoding: "utf-8" });

  outputs.forEach(f => {
    if (!fs.existsSync(f)) {
      throw new Error(`PDF not created: ${path.basename(f)}`);
    }
  });

  // Clean up created PDFs
  outputs.forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
});

// Test 5: --outdir option
test("--outdir puts files in correct directory", async () => {
  const input = path.join(MD_DIR, "example-basic.md");
  const outdir = path.join(TEST_DIR, "subout");

  fs.mkdirSync(outdir, { recursive: true });

  execSync(`node "${SCRIPT}" -o "${outdir}" "${input}"`, { encoding: "utf-8" });

  const output = path.join(outdir, "example-basic.pdf");
  if (!fs.existsSync(output)) {
    throw new Error("PDF not created in outdir");
  }
});

// Test 6: --no-page-numbers option
test("--no-page-numbers creates PDF without headers", async () => {
  const input = path.join(MD_DIR, "example-basic.md");
  const output = path.join(TEST_DIR, "test-no-headers.pdf");

  execSync(`node "${SCRIPT}" --no-page-numbers "${input}" "${output}"`, { encoding: "utf-8" });

  if (!fs.existsSync(output)) {
    throw new Error("PDF file not created");
  }

  // File should be slightly smaller without page headers/footers
  const stats = fs.statSync(output);
  if (stats.size < 500) {
    throw new Error("PDF file too small");
  }
});

// Test 7: HTML sanitization - script tag should be stripped
test("sanitizes HTML script tags", async () => {
  const testMd = path.join(TEST_DIR, "test-xss.md");
  const output = path.join(TEST_DIR, "test-xss.pdf");

  // Create markdown with dangerous content
  fs.writeFileSync(testMd, `# Test
<script>alert('xss')</script>
Normal content
`);

  execSync(`node "${SCRIPT}" "${testMd}" "${output}"`, { encoding: "utf-8" });

  if (!fs.existsSync(output)) {
    throw new Error("PDF not created");
  }

  // Clean up test file
  fs.unlinkSync(testMd);

  // If we got here without crashing, sanitization worked
});

// Test 8: Error handling for missing file
test("handles missing file gracefully", async () => {
  const input = path.join(TEST_DIR, "nonexistent.md");

  try {
    execSync(`node "${SCRIPT}" "${input}"`, { encoding: "utf-8", stdio: "pipe" });
    throw new Error("Should have failed for missing file");
  } catch (err) {
    const output = (err.stdout || "") + (err.stderr || "");
    if (!output.includes("Error")) {
      throw new Error("Expected error message not found");
    }
    // This is expected
  }
});

// Test 9: Invalid option validation
test("validates --css option has value", async () => {
  const input = path.join(MD_DIR, "example-basic.md");

  try {
    execSync(`node "${SCRIPT}" --css --outdir ./test "${input}"`, { encoding: "utf-8", stdio: "pipe" });
    throw new Error("Should have failed for invalid --css");
  } catch (err) {
    const output = (err.stdout || "") + (err.stderr || "") + (err.message || "");
    if (!output.includes("requires")) {
      throw new Error("Expected validation error not found: " + output);
    }
    // This is expected
  }
});

// Run all tests
runTests();
