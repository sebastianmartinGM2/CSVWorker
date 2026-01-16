import { describe, it, expect } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import app from './index';

describe('POST /process-xlsx-template', () => {
  it('accepts an XLSX, validates rows and returns processed XLSX', async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Data');
    const headers = [
      'bankId',
      'accountId',
      'bookingDate',
      'valueDate',
      'conceptCode',
      'concept',
      'amount',
      'direction',
      'currency',
      'balance',
      'counterpartyName',
      'counterpartyIdType',
      'counterpartyIdNumber',
      'counterpartyAccount',
      'reference',
      'rawRowId',
    ];
    sheet.addRow(headers);
    sheet.addRow([
      'icbc',
      'acct-1',
      '2025-12-01',
      '',
      '',
      'Pago factura',
      1500,
      'debit',
      'ARS',
      10000,
      'Comercio X',
      'CUIT',
      '20304050607',
      'alias123',
      'ref-1',
      'row-1',
    ]);

    const buf = await wb.xlsx.writeBuffer();

    const res = await request(app)
      .post('/process-xlsx-template')
      .attach('file', Buffer.from(buf), 'input.xlsx');

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    expect(res.body).toBeDefined();
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('returns X-Validation-Errors header when input has invalid rows', async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Data');
    const headers = ['bankId', 'accountId', 'bookingDate', 'concept', 'amount', 'direction', 'currency', 'rawRowId'];
    sheet.addRow(headers);
    // invalid: amount not a number, missing required fields
    sheet.addRow(['icbc', '', 'not-a-date', '', 'abc', 'wrong', 'ARS', 'r2']);

    const buf = await wb.xlsx.writeBuffer();

    const res = await request(app)
      .post('/process-xlsx-template')
      .attach('file', Buffer.from(buf), 'input-invalid.xlsx');

    expect(res.status).toBe(200);
    // validation errors header should exist
    expect(res.headers['x-validation-errors']).toBeDefined();
  });
});
