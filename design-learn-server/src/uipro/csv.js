const fs = require('fs');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        const next = text[index + 1];
        if (next === '"') {
          field += '"';
          index += 1;
          continue;
        }
        inQuotes = false;
        continue;
      }
      field += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (char === '\r') {
      continue;
    }

    if (char === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field);
  rows.push(row);

  return rows.filter((record) => record.some((cell) => String(cell).trim() !== ''));
}

function parseCsvFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCsv(raw);
  if (rows.length === 0) {
    return { headers: [], records: [] };
  }

  const headers = rows[0].map((cell, index) => {
    const value = String(cell ?? '');
    const cleaned = index === 0 ? value.replace(/^\uFEFF/, '') : value;
    return cleaned.trim();
  });

  const records = rows.slice(1).map((cells) => {
    const record = {};
    for (let index = 0; index < headers.length; index += 1) {
      const key = headers[index];
      if (!key) {
        continue;
      }
      record[key] = String(cells[index] ?? '').trim();
    }
    return record;
  });

  return { headers, records };
}

module.exports = {
  parseCsvFile,
};

