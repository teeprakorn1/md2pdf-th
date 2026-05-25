/**
 * md2pdf-th NestJS Service
 * Injectable service for converting Markdown to PDF in NestJS applications
 */

const { md2pdfTh, mergePdfBuffers, VERSION } = require("../md2pdf-core");

/**
 * @typedef {Object} Md2PdfServiceOptions
 * @property {string} [theme] - PDF theme ('light' or 'dark')
 * @property {string} [cover] - Cover page HTML template
 * @property {string} [toc] - Table of contents HTML template
 * @property {string} [watermark] - Watermark text
 * @property {Object} [pdf] - Puppeteer PDF options
 * @property {Object} [html] - HTML rendering options
 */

class Md2PdfService {
  /**
   * @param {Md2PdfServiceOptions} defaults - Default configuration options
   */
  constructor(defaults = {}) {
    this._defaults = defaults;
  }

  /**
   * Merge default options with provided options
   * @param {Object} options - Options to merge
   * @returns {Object} Merged options
   */
  _merge(options) {
    return { ...this._defaults, ...options };
  }

  /**
   * Convert Markdown to PDF
   * @param {Object} options - Conversion options
   * @returns {Promise<Buffer>} PDF buffer
   */
  async convert(options) {
    return md2pdfTh(this._merge(options));
  }
  
  /**
   * Convert Markdown content to PDF buffer
   * @param {string} content - Markdown content to convert
   * @param {Object} options - Conversion options
   * @returns {Promise<Buffer>} PDF buffer
   */
  async convertFromContent(content, options = {}) {
    return md2pdfTh(this._merge({ ...options, content }));
  }

  /**
   * Convert Markdown file to PDF buffer
   * @param {string} inputPath - Path to input Markdown file
   * @param {Object} options - Conversion options
   * @returns {Promise<Buffer>} PDF buffer
   */
  async convertFromFile(inputPath, options = {}) {
    return md2pdfTh(this._merge({ inputPath, ...options }));
  }

  /**
   * Convert Markdown file to PDF file
   * @param {string} inputPath - Path to input Markdown file
   * @param {string} outputPath - Path to output PDF file
   * @param {Object} options - Conversion options
   * @returns {Promise<void>}
   */
  async convertToFile(inputPath, outputPath, options = {}) {
    return md2pdfTh(this._merge({ inputPath, outputPath, ...options }));
  }

  /**
   * Merge multiple PDF buffers into a single buffer
   * @param {Buffer[]} pdfBuffers - Array of PDF buffers to merge
   * @returns {Promise<Buffer>} Merged PDF buffer
   */
  async merge(pdfBuffers) {
    return mergePdfBuffers(pdfBuffers);
  }

  /**
   * Get the version of md2pdf-th
   * @returns {string} Version string
   */
  getVersion() {
    return VERSION;
  }
}

module.exports = { Md2PdfService };
