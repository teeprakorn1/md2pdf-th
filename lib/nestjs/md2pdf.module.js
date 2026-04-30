/**
 * md2pdf-th NestJS Module
 *
 * Usage:
 *   const { Md2PdfModule, Md2PdfService } = require('md2pdf-th/nestjs');
 *
 *   // Synchronous registration
 *   Md2PdfModule.forRoot({ theme: 'dark' })
 *
 *   // Async registration
 *   Md2PdfModule.forRootAsync({ useFactory: () => configService.get('md2pdf'), inject: [ConfigService] })
 *
 *   // Then inject in controller/service:
 *   constructor(private md2pdf: Md2PdfService) {}
 *   const pdf = await this.md2pdf.convertFromContent('# Hello');
 */

const { Md2PdfService } = require("./md2pdf.service");

const MD2PDF_OPTIONS_TOKEN = "MD2PDF_OPTIONS";

class Md2PdfModule {
  static forRoot(defaults = {}) {
    return {
      module: Md2PdfModule,
      global: true,
      providers: [
        { provide: MD2PDF_OPTIONS_TOKEN, useValue: defaults },
        {
          provide: Md2PdfService,
          useFactory: (options) => new Md2PdfService(options),
          inject: [MD2PDF_OPTIONS_TOKEN],
        },
      ],
      exports: [Md2PdfService],
    };
  }

  static forRootAsync(options = {}) {
    return {
      module: Md2PdfModule,
      global: true,
      providers: [
        {
          provide: MD2PDF_OPTIONS_TOKEN,
          useFactory: options.useFactory || (() => ({})),
          inject: options.inject || [],
        },
        {
          provide: Md2PdfService,
          useFactory: (md2pdfOptions) => new Md2PdfService(md2pdfOptions),
          inject: [MD2PDF_OPTIONS_TOKEN],
        },
      ],
      exports: [Md2PdfService],
    };
  }
}

module.exports = { Md2PdfModule, Md2PdfService, MD2PDF_OPTIONS_TOKEN };
