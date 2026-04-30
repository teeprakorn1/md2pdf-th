/**
 * md2pdf-th — TypeScript type definitions
 */

export interface Md2PdfOptions {
  /** Markdown content string (alternative to inputPath) */
  content?: string;
  /** Path to .md file (alternative to content) */
  inputPath?: string;
  /** Output PDF file path. If omitted, returns Buffer */
  outputPath?: string;
  /** Custom CSS string */
  css?: string;
  /** Path to custom CSS file */
  cssPath?: string;
  /** Color theme */
  theme?: "light" | "dark";
  /** Generate Table of Contents */
  toc?: boolean;
  /** Add cover page from frontmatter */
  cover?: boolean;
  /** Custom header text */
  headerText?: string;
  /** Custom footer text */
  footerText?: string;
  /** Page size */
  format?: "A3" | "A4" | "A5" | "Letter" | "Legal" | "Tabloid";
  /** Custom font family */
  font?: string;
  /** Disable page numbers */
  noPageNumbers?: boolean;
  /** Language hint for font selection */
  lang?: "th" | "en";
}

export interface FrontmatterMeta {
  title: string;
  author: string;
  date: string;
  tags: string[];
  description: string;
  rawLength: number;
}

/**
 * Convert Markdown to PDF
 * @returns PDF Buffer
 */
export function md2pdfTh(options: Md2PdfOptions): Promise<Buffer>;

/** Merge multiple PDF buffers into one */
export function mergePdfBuffers(pdfBuffers: Buffer[]): Promise<Buffer>;

/** Strip dangerous HTML tags and event handlers */
export function sanitizeHtml(content: string): string;

/** Escape HTML special characters */
export function escapeHtml(str: string): string;

/** Extract title from markdown content */
export function extractTitleFromContent(content: string, maxLen?: number, fallback?: string): string;

/** Generate Table of Contents markdown from content */
export function generateToc(content: string): string;

/** Generate cover page HTML */
export function generateCoverPage(title: string, author: string, date: string): string;

/** Parse YAML frontmatter from markdown */
export function parseFrontmatter(content: string): FrontmatterMeta;

/** Strip YAML frontmatter from markdown */
export function stripFrontmatter(content: string): string;

/** Add PDF metadata using pdf-lib */
export function addPdfMetadata(pdfBytes: Buffer | Uint8Array, metadata: Record<string, string>): Promise<Uint8Array>;

/** Library version (from package.json) */
export const VERSION: string;

/** Supported page sizes */
export const PAGE_SIZES: string[];
