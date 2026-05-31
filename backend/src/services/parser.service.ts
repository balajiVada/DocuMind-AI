import fs from 'fs';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import csv from 'csv-parser';
import * as xlsx from 'xlsx';
import officeParser from 'officeparser';

export interface ParsedPage {
  text: string;
  pageNumber: number;
}

export class ParserService {
  public async parseFile(filePath: string, fileType: string): Promise<ParsedPage[]> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at path: ${filePath}`);
    }

    switch (fileType.toLowerCase()) {
      case 'pdf':
        return this.parsePdf(filePath);
      case 'docx':
        return this.parseDocx(filePath);
      case 'txt':
        return this.parseTxt(filePath);
      case 'csv':
        return this.parseCsv(filePath);
      case 'xlsx':
        return this.parseXlsx(filePath);
      case 'pptx':
        return this.parsePptx(filePath);
      default:
        throw new Error(`Unsupported file format: ${fileType}`);
    }
  }

  private async parsePdf(filePath: string): Promise<ParsedPage[]> {
    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const result = await parser.getText();
    
    return result.pages.map((page: any) => ({
      text: page.text,
      pageNumber: page.num,
    }));
  }

  private async parseDocx(filePath: string): Promise<ParsedPage[]> {
    const result = await mammoth.extractRawText({ path: filePath });
    return [{ text: result.value, pageNumber: 1 }];
  }

  private async parseTxt(filePath: string): Promise<ParsedPage[]> {
    const text = fs.readFileSync(filePath, 'utf8');
    return [{ text, pageNumber: 1 }];
  }

  private async parseCsv(filePath: string): Promise<ParsedPage[]> {
    return new Promise((resolve, reject) => {
      const results: string[] = [];
      let rowNumber = 1;
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          results.push(`Row ${rowNumber}: ` + Object.values(data).join(' | '));
          rowNumber++;
        })
        .on('end', () => {
          resolve([{ text: results.join('\n'), pageNumber: 1 }]);
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  private async parseXlsx(filePath: string): Promise<ParsedPage[]> {
    const workbook = xlsx.readFile(filePath);
    let fullText = '';
    
    workbook.SheetNames.forEach((sheetName) => {
      fullText += `\n--- Sheet: ${sheetName} ---\n`;
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return;
      const json = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
      
      json.forEach((row, index) => {
        fullText += `Row ${index + 1}: ` + row.join(' | ') + '\n';
      });
    });

    return [{ text: fullText.trim(), pageNumber: 1 }];
  }

  private async parsePptx(filePath: string): Promise<ParsedPage[]> {
    try {
      const text = (await officeParser.parseOffice(filePath)) as any;
      return [{ text: typeof text === 'string' ? text : JSON.stringify(text), pageNumber: 1 }];
    } catch (error) {
      throw new Error(`Failed to parse PPTX: ${error}`);
    }
  }
}

export const parserService = new ParserService();
