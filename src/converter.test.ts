import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import CsvToExcelConverter from './converter';

describe('CsvToExcelConverter', () => {
  it('parses CSV and returns excel buffer and analysis', async () => {
    const csv = 'name,age\nAlice,30\nBob,25\n';
    const converter = new CsvToExcelConverter();
    const { excelBuffer, analysis } = await converter.convert(Buffer.from(csv, 'utf8'));
    expect(analysis.rowCount).toBe(2);
    expect(analysis.columns).toEqual(['name', 'age']);
    expect(Buffer.isBuffer(excelBuffer)).toBe(true);
    expect(excelBuffer.length).toBeGreaterThan(0);
  });

  it('validates CSV rows with Zod', () => {
    const csv = 'name,age\nAlice,30\nBob,not-a-number\n';
    const schema = z.object({ name: z.string().min(1), age: z.coerce.number() });
    const converter = new CsvToExcelConverter(schema as any);
    const { records, analysis, validationErrors } = converter.parse(Buffer.from(csv, 'utf8')) as any;
    expect(analysis.rowCount).toBe(1);
    expect(records.length).toBe(1);
    expect(validationErrors).toBeDefined();
    expect(validationErrors.length).toBe(1);
  });

  it('analyze returns correct missing/unique counts', () => {
    const records = [{ name: 'A', val: '1' }, { name: '', val: '1' }, { name: 'B', val: '' }];
    const converter = new CsvToExcelConverter();
    const analysis = converter.analyze(records as any);
    expect(analysis.rowCount).toBe(3);
    expect(analysis.columnAnalysis['name'].missing).toBe(1);
    expect(analysis.columnAnalysis['val'].missing).toBe(1);
  });
});
