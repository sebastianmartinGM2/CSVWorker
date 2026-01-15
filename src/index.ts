import express from 'express';
import multer from 'multer';
import CsvToExcelConverter from './converter';
import { readFile } from 'fs/promises';
import path from 'path';

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

export default app;

// Start server only when executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor Express escuchando en http://localhost:${PORT}`);
  });
}
