/**
 * md2pdf-th NestJS Integration
 * Entry point for NestJS module imports
 *
 * Usage:
 *   const { Md2PdfModule, Md2PdfService } = require('md2pdf-th/lib/nestjs');
 *   // or in TypeScript:
 *   // import { Md2PdfModule, Md2PdfService } from 'md2pdf-th/lib/nestjs';
 */

module.exports = {
  Md2PdfModule: require("./md2pdf.module").Md2PdfModule,
  Md2PdfService: require("./md2pdf.service").Md2PdfService,
};
