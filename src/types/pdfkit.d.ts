declare module "pdfkit" {
  const PDFDocument: any;
  export default PDFDocument;
}

declare namespace PDFKit {
  interface PDFDocument {
    [key: string]: any;
  }
}
