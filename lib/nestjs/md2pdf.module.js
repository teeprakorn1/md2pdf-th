/**
 * md2pdf-th NestJS Module
 * Import: Md2PdfModule.forRoot() or Md2PdfModule.forRootAsync()
 *
 * Usage in NestJS:
 *   import { Md2PdfModule } from 'md2pdf-th/lib/nestjs';
 *   @Module({ imports: [Md2PdfModule.forRoot({ theme: 'dark' })] }) 
 *   class AppModule {}
 *
 *   Then inject: constructor(private md2pdf: Md2PdfService) {}
 *   const pdf = await this.md2pdf.convertFromContent('# Hello');
 */

const { Md2PdfService } = require("./md2pdf.service");

class Md2PdfModule {
  /**
   * Register module with default options
   * @param {object} [defaults] - Default conversion options
   * @returns {object} Dynamic module
   */
  static forRoot(defaults = {}) {
    return {
      module: Md2PdfModule,
      providers: [
        { provide: "MD2PDF_OPTIONS", useValue: defaults },
        {
          provide: Md2PdfService,
          useFactory: (options) => {
            const service = new Md2PdfService();
            service._defaults = options;
            return service;
          },
          inject: ["MD2PDF_OPTIONS"],
        },
      ],
      exports: [Md2PdfService],
    };
  }

  /**
   * Register module asynchronously
   * @param {object} options - Async configuration
   * @param {any} options.useFactory - Factory function returning default options
   * @param {any[]} [options.inject] - Dependencies to inject
   * @returns {object} Dynamic module
   */
  static forRootAsync(options = {}) {
    return {
      module: Md2PdfModule,
      providers: [
        {
          provide: "MD2PDF_OPTIONS",
          useFactory: options.useFactory || (() => ({})),
          inject: options.inject || [],
        },
        {
          provide: Md2PdfService,
          useFactory: (md2pdfOptions) => {
            const service = new Md2PdfService();
            service._defaults = md2pdfOptions;
            return service;
          },
          inject: ["MD2PDF_OPTIONS"],
        },
      ],
      exports: [Md2PdfService],
    };
  }
}

module.exports = { Md2PdfModule, Md2PdfService };
