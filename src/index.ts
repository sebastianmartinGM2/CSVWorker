import express from 'express';
import multer from 'multer';
import CsvToExcelConverter from './converter';
import { readFile } from 'fs/promises';
import path from 'path';
import ExcelJS from 'exceljs';
import BankMovementSchema from './models';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();
const upload = multer();
const converter = new CsvToExcelConverter();

app.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<h1>CSV → Excel</h1>
<form method="post" enctype="multipart/form-data" action="/convert">
  <input type="file" name="file" accept=".csv" />
  <button type="submit">Convertir</button>
</form>
<hr />
<h2>Prueba rápida (sample)</h2>
<p>
  <button id="convert-sample">Convertir sample/test.csv</button>
  <button id="analyze-sample">Analizar sample/test.csv</button>
</p>
<pre id="analysis-output" style="background:#f6f8fa;padding:8px;display:none;"></pre>
<script>
document.getElementById('convert-sample').addEventListener('click', () => {
  // navigate to endpoint that returns the converted xlsx
  window.location.href = '/convert-sample';
});
document.getElementById('analyze-sample').addEventListener('click', async () => {
  const out = document.getElementById('analysis-output');
  out.style.display = 'block';
  out.textContent = 'Analizando...';
  try {
    const res = await fetch('/analyze-sample');
    const json = await res.json();
    out.textContent = JSON.stringify(json, null, 2);
  } catch (err) {
    out.textContent = 'Error: ' + err;
  }
});
</script>
`);
});

app.post('/convert', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No se ha subido archivo');
    const { excelBuffer, analysis } = await converter.convert(req.file.buffer);
    res.setHeader('Content-Disposition', 'attachment; filename="converted.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // optional: send analysis in header as JSON (truncated)
    res.setHeader('X-Analysis', encodeURIComponent(JSON.stringify(analysis)));
    res.send(excelBuffer);
  } catch (err: any) {
    console.error(err);
    res.status(500).send(String(err.message || err));
  }
});

// Devuelve sólo el análisis JSON del CSV subido
app.post('/analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    // usar parse internamente a través del converter
    const csvBuffer = req.file.buffer;
    // converter.convert también devuelve el análisis, pero evitar generar el excel por rendimiento
    const csv = csvBuffer.toString('utf8');
    // parse here to get records and then analyze
    const { parse } = await import('csv-parse/sync');
    const records = parse(csv, { columns: true, skip_empty_lines: true, relax_quotes: true, trim: true }) as Record<string, any>[];
    const analysis = converter.analyze(records);
    res.json({ analysis });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Convert sample CSV on server and return XLSX
app.get('/convert-sample', async (_req, res) => {
  try {
    const buf = await readFile(path.join(__dirname, '..', 'samples', 'test.csv'));
    const { excelBuffer, analysis } = await converter.convert(buf);
    res.setHeader('Content-Disposition', 'attachment; filename="converted-sample.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('X-Analysis', encodeURIComponent(JSON.stringify(analysis)));
    res.send(excelBuffer);
  } catch (err: any) {
    console.error(err);
    res.status(500).send(String(err.message || err));
  }
});

// Return analysis JSON for sample CSV
app.get('/analyze-sample', async (_req, res) => {
  try {
    const buf = await readFile(path.join(__dirname, '..', 'samples', 'test.csv'));
    const { parse } = await import('csv-parse/sync');
    const records = parse(buf.toString('utf8'), { columns: true, skip_empty_lines: true, relax_quotes: true, trim: true }) as Record<string, any>[];
    const analysis = converter.analyze(records);
    res.json({ analysis });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Return parsed CSV as JSON (records) for uploaded file
app.post('/convert-json', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { records, analysis } = converter.parse(req.file.buffer);
    res.json({ records, analysis });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Return parsed JSON for sample CSV
app.get('/convert-sample-json', async (_req, res) => {
  try {
    const buf = await readFile(path.join(__dirname, '..', 'samples', 'test.csv'));
    const { parse } = await import('csv-parse/sync');
    const records = parse(buf.toString('utf8'), { columns: true, skip_empty_lines: true, relax_quotes: true, trim: true }) as Record<string, any>[];
    const analysis = converter.analyze(records);
    res.json({ records, analysis });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Return parsed CSV as downloadable JSON file for uploaded file
app.post('/convert-download-json', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { records, analysis } = converter.parse(req.file.buffer);
    const payload = { records, analysis };
    const jsonStr = JSON.stringify(payload, null, 2);
    res.setHeader('Content-Disposition', 'attachment; filename="converted.json"');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(jsonStr);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// Procesa un XLSX con movimientos bancarios, valida contra BankMovementSchema
// y escribe un nuevo XLSX usando un template (escribe en las dos primeras sheets).
app.post('/process-xlsx-template', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
    const sheet = wb.worksheets[0];
    if (!sheet) return res.status(400).json({ error: 'Uploaded XLSX has no worksheets' });

    // leer encabezados (fila 1)
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, _colNumber) => {
      const txt = (cell && (cell.text ?? cell.value)) || '';
      headers.push(String(txt).trim());
    });

    const parsedRecords: any[] = [];
    const validationErrors: any[] = [];

    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      // skip fully empty rows
      const isEmpty = row.values.every((v: any) => v === null || v === undefined || v === '');
      if (isEmpty) continue;

      const rec: Record<string, any> = {};
      for (let c = 1; c <= headers.length; c++) {
        const key = headers[c - 1] || `col${c}`;
        const cell = row.getCell(c);
        const val = cell && (cell.text ?? cell.value);
        rec[key] = typeof val === 'string' ? val.trim() : val;
      }

      const resParse = (BankMovementSchema as any).safeParse(rec);
      if (!resParse.success) {
        validationErrors.push({ row: r, errors: resParse.error.format ? resParse.error.format() : resParse.error.errors });
      } else {
        parsedRecords.push(resParse.data);
      }
    }

    // cargar template
    const templatePath = path.join(__dirname, '..', 'templates', 'template.xlsx');
    const outWb = new ExcelJS.Workbook();
    await outWb.xlsx.readFile(templatePath);
    const outSheet1 = outWb.worksheets[0] ?? outWb.addWorksheet('Sheet1');
    const outSheet2 = outWb.worksheets[1] ?? outWb.addWorksheet('Sheet2');

    const cols = [
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

    // limpiar filas existentes (dejando fila de encabezado en 1)
    while (outSheet1.rowCount > 1) outSheet1.spliceRows(2, 1);
    outSheet1.getRow(1).values = cols;

    for (const r of parsedRecords) {
      const rowVals = cols.map((k) => {
        const v = r[k as keyof typeof r];
        if (v instanceof Date) return v.toISOString().split('T')[0];
        return v;
      });
      outSheet1.addRow(rowVals);
    }

    const cols2 = ['bookingDate', 'accountId', 'concept', 'amount', 'direction', 'currency'];
    while (outSheet2.rowCount > 1) outSheet2.spliceRows(2, 1);
    outSheet2.getRow(1).values = cols2;
    for (const r of parsedRecords) {
      outSheet2.addRow(cols2.map((k) => {
        const v = r[k as keyof typeof r];
        if (v instanceof Date) return v.toISOString().split('T')[0];
        return v;
      }));
    }

    const outBuf = await outWb.xlsx.writeBuffer();
    res.setHeader('Content-Disposition', 'attachment; filename="processed.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    if (validationErrors.length) res.setHeader('X-Validation-Errors', encodeURIComponent(JSON.stringify(validationErrors)));
    res.send(Buffer.from(outBuf));
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

export default app;

// Start server only when executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor Express escuchando en http://localhost:${PORT}`);
  });
}
