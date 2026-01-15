# CSVWorker

Proyecto mínimo para convertir CSV a Excel y analizar su contenido.

Archivos importantes:
- `src/converter.ts` — clase `CsvToExcelConverter`.
- `src/index.ts` — servidor Express con endpoints `/convert` y `/analyze`.

CSV de ejemplo
---------------
Incluyo un CSV de prueba en `samples/test.csv`.

Probar localmente (PowerShell):

```powershell
# Instala dependencias
npm install

# Inicia el servidor en modo desarrollo
npm run dev

# Convertir y descargar XLSX (usa el CSV de ejemplo)
curl -F "file=@samples/test.csv" http://localhost:3000/convert --output converted.xlsx

# Obtener sólo el análisis JSON
curl -F "file=@samples/test.csv" http://localhost:3000/analyze
```

O abre `http://localhost:3000` en el navegador y sube `samples/test.csv` desde el formulario.

Enlace directo
--------------
Si el servidor está en ejecución puedes descargar directamente el XLSX generado a partir del CSV de ejemplo:

[Descargar converted-sample.xlsx](http://localhost:3000/convert-sample)

JSON endpoints
--------------
Además de `/convert` (devuelve XLSX) y `/analyze` (devuelve análisis), hay endpoints que devuelven JSON:

- `POST /convert-json` — recibe un `multipart/form-data` con el campo `file` y devuelve `{ records, analysis }`.
- `GET /convert-sample-json` — devuelve `{ records, analysis }` para `samples/test.csv`.

Ejemplos (PowerShell):

```powershell
# Convertir a JSON subiendo un archivo
curl.exe -F "file=@samples/test.csv" http://localhost:3000/convert-json

# Obtener JSON del sample
curl.exe http://localhost:3000/convert-sample-json
```

La propiedad `analysis.columnAnalysis` incluye ahora `examples`: un array con hasta 3 valores frecuentes por columna.

