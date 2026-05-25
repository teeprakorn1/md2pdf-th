/**
 * md2pdf-th NestJS — TypeScript type definitions
 */

import { Md2PdfOptions } from "./index";

/**
 * NestJS service for md2pdf-th
 */
export class Md2PdfService {
  constructor(defaults?: Md2PdfOptions);
  convert(options: Md2PdfOptions): Promise<Buffer>;
  convertFromContent(content: string, options?: Md2PdfOptions): Promise<Buffer>;
  convertFromFile(inputPath: string, options?: Md2PdfOptions): Promise<Buffer>;
  convertToFile(inputPath: string, outputPath: string, options?: Md2PdfOptions): Promise<Buffer>;
  merge(pdfBuffers: Buffer[]): Promise<Buffer>;
  getVersion(): string;
}

/**
 * NestJS module for md2pdf-th
 */
export class Md2PdfModule {
  /**
   * Register module with default options
   */
  static forRoot(defaults?: Md2PdfOptions): {
    module: typeof Md2PdfModule;
    global: boolean;
    providers: any[];
    exports: any[];
  };
  
  /**
   * Register module with async options
   */
  static forRootAsync(options: {
    useFactory?: (...args: any[]) => Md2PdfOptions | Promise<Md2PdfOptions>;
    inject?: any[];
  }): {
    module: typeof Md2PdfModule;
    global: boolean;
    providers: any[];
    exports: any[];
  };
}
