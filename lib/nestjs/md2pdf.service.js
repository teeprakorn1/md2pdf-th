/**
 * md2pdf-th NestJS Service
 * Injectable service for converting Markdown to PDF in NestJS applications
 */

const { md2pdfTh, mergePdfBuffers, VERSION } = require("../md2pdf-core");

class Md2PdfService {
  constructor(defaults = {}) {
    this._defaults = defaults;
  }

  _merge(options) {
    return { ...this._defaults, ...options };
  }

  async convert(options) {
    return md2pdfTh(this._merge(options));
  }

  async convertFromContent(content, options = {}) {
    return md2pdfTh(this._merge({ content, ...options }));
  }

  async convertFromFile(inputPath, options = {}) {
    return md2pdfTh(this._merge({ inputPath, ...options }));
  }

  async convertToFile(inputPath, outputPath, options = {}) {
    return md2pdfTh(this._merge({ inputPath, outputPath, ...options }));
  }

  async merge(pdfBuffers) {
    return mergePdfBuffers(pdfBuffers);
  }

  getVersion() {
    return VERSION;
  }
}

module.exports = { Md2PdfService };
