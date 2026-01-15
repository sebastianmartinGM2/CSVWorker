import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { ZodSchema } from 'zod';

type Analysis = {
  rowCount: number;
  columns: string[];
  columnAnalysis: Record<string, { type: string; missing: number; unique: number; examples: string[] }>;
};

export class CsvToExcelConverter {
  private schema?: ZodSchema<any>;

  constructor(schema?: ZodSchema<any>) {
    this.schema = schema;
  }

  analyze(records: Record<string, any>[]): Analysis {
    const rowCount = records.length;
    const columns = records.length > 0 ? Object.keys(records[0]) : [];
    const columnAnalysis: Record<string, any> = {};

    for (const col of columns) {
      const values = records.map((r) => r[col]);
      const missing = values.filter((v) => v === null || v === undefined || v === '').length;
      const nonEmptyValues = values.filter((v) => v !== null && v !== undefined && v !== '');
      const unique = new Set(nonEmptyValues).size;
      // top 3 frequent values as examples
      const freq = new Map<string, number>();
      for (const v of nonEmptyValues) {
        const s = String(v);
        freq.set(s, (freq.get(s) || 0) + 1);
      }
      const examples = Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map((e) => e[0]);

      // simple type inference: number if most values parse as number, date if parseable as date
      let numCount = 0;
      let dateCount = 0;
      for (const v of values) {
        if (v === null || v === undefined || v === '') continue;
        const s = String(v).trim();
        if (s === '') continue;
        if (!Number.isNaN(Number(s))) numCount++;
        else if (!Number.isNaN(Date.parse(s))) dateCount++;
      }
      let type = 'string';
      if (numCount > dateCount && numCount >= values.length / 2) type = 'number';
      else if (dateCount > numCount && dateCount >= values.length / 2) type = 'date';

      columnAnalysis[col] = { type, missing, unique, examples };
    }

    return { rowCount, columns, columnAnalysis };
  }

  async convert(buffer: Buffer): Promise<{ excelBuffer: Buffer; analysis: Analysis }> {
    const csv = buffer.toString('utf8');
    let records = parse(csv, { columns: true, skip_empty_lines: true, relax_quotes: true, trim: true }) as Record<string, any>[];

    let validationErrors: { row: number; errors: any }[] = [];
    if (this.schema) {
      const kept: Record<string, any>[] = [];
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const res = this.schema.safeParse(r);
        if (!res.success) {
          validationErrors.push({ row: i + 1, errors: res.error.format ? res.error.format() : res.error.errors });
        } else {
          kept.push(res.data);
        }
      }
      records = kept;
    }

    const analysis = this.analyze(records);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Data');

    // set columns
    sheet.columns = analysis.columns.map((c) => ({ header: c, key: c }));
    // add rows
    for (const r of records) {
      const row = analysis.columns.map((c) => r[c]);
      sheet.addRow(row);
    }

    // add analysis sheet
    const aSheet = workbook.addWorksheet('Analysis');
    aSheet.addRow(['Row count', analysis.rowCount]);
    aSheet.addRow([]);
    aSheet.addRow(['Column', 'Type', 'Missing', 'Unique']);
    for (const col of analysis.columns) {
      const ca = analysis.columnAnalysis[col];
      aSheet.addRow([col, ca.type, ca.missing, ca.unique]);
    }

    const excelBuffer = await workbook.xlsx.writeBuffer();
    return { excelBuffer: Buffer.from(excelBuffer), analysis, ...(validationErrors.length ? { validationErrors } : {}) } as any;
  }

  // Parse CSV buffer and return records with analysis (no excel generation)
  parse(buffer: Buffer): { records: Record<string, any>[]; analysis: Analysis; validationErrors?: { row: number; errors: any }[] } {
    const csv = buffer.toString('utf8');
    let records = parse(csv, { columns: true, skip_empty_lines: true, relax_quotes: true, trim: true }) as Record<string, any>[];

    let validationErrors: { row: number; errors: any }[] = [];
    if (this.schema) {
      const kept: Record<string, any>[] = [];
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const res = this.schema.safeParse(r);
        if (!res.success) {
          validationErrors.push({ row: i + 1, errors: res.error.format ? res.error.format() : res.error.errors });
        } else {
          kept.push(res.data);
        }
      }
      records = kept;
    }

    const analysis = this.analyze(records);
    return { records, analysis, ...(validationErrors.length ? { validationErrors } : {}) } as any;
  }
}

export default CsvToExcelConverter;
