export interface CsvRow {
  /** 1-based spreadsheet row number (row 1 is header, data starts at row 2). */
  rowNumber: number;
  values: Record<string, string>;
}

export interface ParsedCsvData {
  fileName: string;
  fileSize: number;
  headers: string[];
  duplicateHeaders: string[];
  rows: CsvRow[];
  parseWarnings: string[];
}

