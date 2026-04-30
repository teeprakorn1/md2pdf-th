/**
 * md2pdf-th NestJS Service
 * Injectable service for converting Markdown to PDF in NestJS applications
 */

const { md2pdfTh, mergePdfBuffers, VERSION } = require("../md2pdf-core");

class Md2PdfService {
  /**
   * Convert Markdown to PDF buffer
   * @param {object} options - Same options as md2pdfTh()
   * @returns {Promise<Buffer>} PDF buffer
   */
  async convert(options) {
    return md2pdfTh(options);
  }

  /**
   * Convert Markdown string to PDF buffer
   * @param {string} content - Markdown content
   * @param {object} [options] - Additional options
   * @returns {Promise<Buffer>}
   */
  async convertFromContent(content, options = {}) {
    return md2pdfTh({ content, ...options });
  }

  /**
   * Convert Markdown file to PDF buffer
   * @param {string} inputPath - Path to .md file
   * @param {object} [options] - Additional options
   * @returns {Promise<Buffer>}
   */
  async convertFromFile(inputPath, options = {}) {
    return md2pdfTh({ inputPath, ...options });
  }

  /**
   * Convert Markdown to PDF and save to file
   * @param {string} inputPath - Path to .md file
   * @param {string} outputPath - Path to output .pdf file
   * @param {object} [options] - Additional options
   * @returns {Promise<Buffer>}
   */
  async convertToFile(inputPath, outputPath, options = {}) {
    return md2pdfTh({ inputPath, outputPath, ...options });
  }

  /**
   * Merge multiple PDF buffers into one
   * @param {Buffer[]} pdfBuffers - Array of PDF buffers
   * @returns {Promise<Buffer>} Merged PDF buffer
   */
  async merge(pdfBuffers) {
    return mergePdfBuffers(pdfBuffers);
  }

  /** Get library version */
  getVersion() {
    return VERSION;
  }
}

module.exports = { Md2PdfService };
