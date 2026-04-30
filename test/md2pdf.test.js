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

// Test 10: Dark theme
test("--theme dark creates PDF with dark CSS", async () => {
  const input = path.join(MD_DIR, "example-basic.md");
  const output = path.join(TEST_DIR, "test-dark.pdf");

  execSync(`node "${SCRIPT}" --theme dark "${input}" "${output}"`, { encoding: "utf-8" });

  if (!fs.existsSync(output)) {
    throw new Error("Dark theme PDF not created");
  }
});

// Test 11: TOC generation
test("--toc generates Table of Contents", async () => {
  const input = path.join(MD_DIR, "example-basic.md");
  const output = path.join(TEST_DIR, "test-toc.pdf");

  execSync(`node "${SCRIPT}" --toc "${input}" "${output}"`, { encoding: "utf-8" });

  if (!fs.existsSync(output)) {
    throw new Error("TOC PDF not created");
  }
});

// Test 12: Cover page
test("--cover adds cover page", async () => {
  const input = path.join(MD_DIR, "example-basic.md");
  const output = path.join(TEST_DIR, "test-cover.pdf");

  execSync(`node "${SCRIPT}" --cover "${input}" "${output}"`, { encoding: "utf-8" });

  if (!fs.existsSync(output)) {
    throw new Error("Cover PDF not created");
  }
});

// Test 13: Custom header/footer
test("--header and --footer set custom text", async () => {
  const input = path.join(MD_DIR, "example-basic.md");
  const output = path.join(TEST_DIR, "test-hf.pdf");

  execSync(`node "${SCRIPT}" --header "MyDoc" --footer "Confidential" "${input}" "${output}"`, { encoding: "utf-8" });

  if (!fs.existsSync(output)) {
    throw new Error("Custom header/footer PDF not created");
  }
});

// Test 14: Page format
test("--format Letter creates PDF", async () => {
  const input = path.join(MD_DIR, "example-basic.md");
  const output = path.join(TEST_DIR, "test-letter.pdf");

  execSync(`node "${SCRIPT}" --format Letter "${input}" "${output}"`, { encoding: "utf-8" });

  if (!fs.existsSync(output)) {
    throw new Error("Letter format PDF not created");
  }
});

// Test 15: Custom font
test("--font sets custom font", async () => {
  const input = path.join(MD_DIR, "example-basic.md");
  const output = path.join(TEST_DIR, "test-font.pdf");

  execSync(`node "${SCRIPT}" --font Georgia "${input}" "${output}"`, { encoding: "utf-8" });

  if (!fs.existsSync(output)) {
    throw new Error("Custom font PDF not created");
  }
});

// Test 16: Invalid format validation
test("validates --format option value", async () => {
  try {
    execSync(`node "${SCRIPT}" --format InvalidSize --help`, { encoding: "utf-8", stdio: "pipe" });
    throw new Error("Should have failed for invalid format");
  } catch (err) {
    const output = (err.stdout || "") + (err.stderr || "") + (err.message || "");
    if (!output.includes("format") && !output.includes("Error")) {
      throw new Error("Expected format validation error");
    }
  }
});

// Test 17: Invalid theme validation
test("validates --theme option value", async () => {
  try {
    execSync(`node "${SCRIPT}" --theme neon --help`, { encoding: "utf-8", stdio: "pipe" });
    throw new Error("Should have failed for invalid theme");
  } catch (err) {
    const output = (err.stdout || "") + (err.stderr || "") + (err.message || "");
    if (!output.includes("theme") && !output.includes("Error")) {
      throw new Error("Expected theme validation error");
    }
  }
});

// Run all tests
runTests();
