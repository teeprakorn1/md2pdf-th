/**
 * md2pdf-th NestJS — TypeScript type definitions
 */

import { Md2PdfOptions } from "./index";

export class Md2PdfService {
  constructor(defaults?: Md2PdfOptions);
  convert(options: Md2PdfOptions): Promise<Buffer>;
  convertFromContent(content: string, options?: Md2PdfOptions): Promise<Buffer>;
  convertFromFile(inputPath: string, options?: Md2PdfOptions): Promise<Buffer>;
  convertToFile(inputPath: string, outputPath: string, options?: Md2PdfOptions): Promise<Buffer>;
  merge(pdfBuffers: Buffer[]): Promise<Buffer>;
  getVersion(): string;
}

export class Md2PdfModule {
  static forRoot(defaults?: Md2PdfOptions): {
    module: typeof Md2PdfModule;
    global: boolean;
    providers: any[];
    exports: any[];
  };
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
