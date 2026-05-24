import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

export interface ParsedPage {
  text: string;
  pageNumber: number;
}

export async function parseFile(filePath: string, fileType: string): Promise<ParsedPage[]> {
  const fullPath = path.join(__dirname, '../../uploads', filePath);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found at path: ${fullPath}`);
  }

  if (fileType === 'pdf') {
    const dataBuffer = fs.readFileSync(fullPath);
    
    // Instantiate new PDFParse class from the modern pdf-parse module
    const parser = new PDFParse({ data: dataBuffer });
    const result = await parser.getText();
    
    // Map extracted pages to standard ParsedPage format
    const pages: ParsedPage[] = result.pages.map((page) => ({
      text: page.text,
      pageNumber: page.num,
    }));

    return pages;

  } else if (fileType === 'docx') {
    const result = await mammoth.extractRawText({ path: fullPath });
    return [{
      text: result.value,
      pageNumber: 1,
    }];

  } else if (fileType === 'txt') {
    const text = fs.readFileSync(fullPath, 'utf8');
    return [{
      text,
      pageNumber: 1,
    }];
  } else {
    throw new Error(`Unsupported file format: ${fileType}`);
  }
}
