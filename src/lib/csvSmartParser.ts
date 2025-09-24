import * as XLSX from 'xlsx';

export interface ColumnMapping {
  name?: number;
  phone?: number;
  extra1?: number;
  extra2?: number;
  extra3?: number;
}

export interface CSVAnalysis {
  headers: string[];
  preview: string[][];
  totalRows: number;
  bodyRows: string[][]; // rows without header
  mapping: ColumnMapping;
  limitExceeded?: boolean;
}

const CANDIDATE_DELIMS = [',', ';', '\t', '|'];

function stripBOM(s: string) {
  return s.replace(/^\uFEFF/, '');
}

function normalizeEOL(text: string) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function detectDelimiter(text: string): string {
  const sample = normalizeEOL(text).split('\n').slice(0, 10);
  let bestDelim = ',';
  let bestScore = -1;
  for (const delim of CANDIDATE_DELIMS) {
    let counts: number[] = [];
    for (const line of sample) {
      if (!line) continue;
      // Rough count not in quotes
      let inQuotes = false;
      let cnt = 0;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { i++; continue; }
          inQuotes = !inQuotes;
        } else if (!inQuotes && ch === delim) {
          cnt++;
        }
      }
      counts.push(cnt);
    }
    if (counts.length === 0) continue;
    // Score by median and consistency
    counts.sort((a, b) => a - b);
    const median = counts[Math.floor(counts.length / 2)];
    const variance = counts.reduce((acc, c) => acc + Math.pow(c - median, 2), 0) / counts.length;
    const score = median - variance * 0.01; // prioritize higher counts with low variance
    if (median > 0 && score > bestScore) {
      bestScore = score;
      bestDelim = delim;
    }
  }
  return bestDelim;
}

function parseCSV(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  const s = normalizeEOL(stripBOM(text));
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') {
      if (inQuotes && s[i + 1] === '"') { // escaped quote
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      row.push(cell);
      cell = '';
      continue;
    }
    if (!inQuotes && ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += ch;
  }
  // flush last cell/row
  row.push(cell);
  rows.push(row);

  // trim cells
  return rows.map(r => r.map(c => c.trim()))
             .filter(r => r.some(c => c.length > 0));
}

function isLikelyHeader(cells: string[]): boolean {
  if (!cells || cells.length === 0) return false;
  let signal = 0;
  for (const c of cells) {
    const v = (c || '').trim();
    if (!v) continue;
    const hasLetters = /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(v);
    const hasDigits = /\d/.test(v);
    const hasAt = v.includes('@');
    if (hasAt) { signal -= 1; continue; }
    if (hasLetters && !hasDigits) signal += 2; // words likely header
    else if (!hasLetters && hasDigits) signal -= 1; // numbers likely data
    else signal += 0.5;
  }
  return signal >= 1; // threshold
}

function sanitizeHeaderName(name: string, index: number): string {
  const base = (name || '').toString().replace(/\s+/g, ' ').trim();
  if (!base) return `Coluna ${index + 1}`;
  return base;
}

function buildHeaders(rawRows: string[][]): { headers: string[]; bodyRows: string[][] } {
  const rows = rawRows || [];
  const first = rows[0] || [];
  const hasHeader = isLikelyHeader(first);
  if (hasHeader) {
    const headers = first.map((h, idx) => sanitizeHeaderName(h, idx));
    return { headers, bodyRows: rows.slice(1) };
  } else {
    const maxLen = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const headers = Array.from({ length: maxLen }, (_, i) => `Coluna ${i + 1}`);
    return { headers, bodyRows: rows };
  }
}

function scoreColumnByPattern(values: string[], predicate: (v: string) => boolean): number {
  const n = values.length || 1;
  let c = 0;
  for (const v of values) if (predicate((v || '').trim())) c++;
  return c / n;
}

function suggestColumnMapping(headers: string[], bodyRows: string[][]): ColumnMapping {
  const colCount = headers.length;
  const colValues: string[][] = Array.from({ length: colCount }, (_, j) => bodyRows.map(r => r[j] || ''));

  const headerLower = headers.map(h => (h || '').toLowerCase());
  const map: ColumnMapping = {};

  const headerSignals = headerLower.map(h => ({
    name: /(nome|name|cliente|pessoa|contato)/.test(h) ? 1 : 0,
    email: /(e[- ]?mail|email|mail)/.test(h) ? 1 : 0,
    phone: /(telefone|phone|celular|fone|mobile|whatsapp|ramal)/.test(h) ? 1 : 0,
  }));

  // Pattern scores
  const emailScore = colValues.map(vals => scoreColumnByPattern(vals, v => /.+@.+\..+/.test(v)));
  const phoneScore = colValues.map(vals => scoreColumnByPattern(vals, v => (v.replace(/\D/g, '').length >= 8)));
  const nameScore = colValues.map(vals => scoreColumnByPattern(vals, v => /[A-Za-zÀ-ÖØ-öø-ÿ]{3,}/.test(v) && !/\d{3,}/.test(v)));

  // Combine signals
  const combine = (idx: number, kind: 'name'|'email'|'phone') => {
    const hs = headerSignals[idx] || { name: 0, email: 0, phone: 0 };
    const headerBoost = hs[kind] ? 0.5 : 0;
    const baseArr = kind === 'email' ? emailScore : kind === 'phone' ? phoneScore : nameScore;
    const base = typeof baseArr[idx] === 'number' ? baseArr[idx] : 0;
    return (base || 0) + headerBoost;
  };

  // Pick best indices avoiding duplicates
  let candidates = Array.from({ length: colCount }, (_, i) => i);
  const pickBest = (kind: 'name'|'email'|'phone', min = 0.15) => {
    let best = -1, bestVal = -1;
    if (!Array.isArray(candidates) || candidates.length === 0) return undefined;
    for (const i of candidates) {
      const v = combine(i, kind);
      if (v > bestVal) { bestVal = v; best = i; }
    }
    if (best >= 0 && bestVal >= min) {
      candidates = candidates.filter(i => i !== best);
      return best;
    }
    return undefined;
  };

  map.phone = pickBest('phone', 0.1);
  map.name = pickBest('name', 0.05);

  return map;
}

export async function parseFileToRows(file: File): Promise<string[][]> {
  const name = (file?.name || '').toLowerCase();
  const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
  if (isExcel) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
    // Normalize to strings
    return (rows || []).map(r => (r || []).map(v => (v == null ? '' : String(v))));
  } else {
    const text = await file.text();
    const delim = detectDelimiter(text);
    return parseCSV(text, delim);
  }
}

export function buildPreviewFromRows(rawRows: string[][]): { headers: string[]; preview: string[][]; totalRows: number; bodyRows: string[][]; limitExceeded?: boolean } {
  const { headers, bodyRows } = buildHeaders(rawRows);
  const preview = bodyRows.slice(0, 5).map(r => r.slice(0, headers.length));
  
  // Limite dinâmico será aplicado depois da seleção de agentes
  // Por enquanto não aplicamos limite aqui
  const limitedBodyRows = bodyRows;
  const limitExceeded = false; // Será calculado dinamicamente
  
  return { 
    headers, 
    preview, 
    totalRows: bodyRows.length, 
    bodyRows: limitedBodyRows,
    limitExceeded 
  };
}

export function normalizeContactsFromRows(
  bodyRows: string[][] = [],
  mapping: ColumnMapping = {},
  addCountryCode: boolean = false,
  headers: string[] = []
): Array<{ name?: string; phone?: string; dados_extras?: Record<string, string> }>{
  const contacts: Array<{ name?: string; phone?: string; dados_extras?: Record<string, string> }> = [];
  const safeIndex = (row: string[], idx?: number) => {
    if (idx == null) return undefined;
    if (!Array.isArray(row)) return undefined;
    if (idx < 0 || idx >= row.length) return undefined;
    return row[idx];
  };

  // Debug: Log do mapeamento recebido
  console.log('🔍 [FRONTEND DEBUG] Mapeamento recebido:', mapping);
  console.log('🔍 [FRONTEND DEBUG] Headers:', headers);
  
  for (const r of bodyRows || []) {
    const c: { name?: string; phone?: string; dados_extras?: Record<string, string> } = {};
    const nameVal = safeIndex(r, mapping?.name);
    const phoneVal = safeIndex(r, mapping?.phone);

    if (nameVal != null) {
      const v = String(nameVal).trim();
      if (v) c.name = v;
    }
    if (phoneVal != null) {
      let digits = String(phoneVal).replace(/\D/g, '');
      if (digits.length >= 8) {
        // Adicionar código do país se solicitado e não começar com 55
        if (addCountryCode && !digits.startsWith('55')) {
          digits = '55' + digits;
        }
        c.phone = digits;
      }
    }

    // Processar colunas extras
    const dadosExtras: Record<string, string> = {};
    let hasExtras = false;

    if (mapping.extra1 != null) {
      const val = safeIndex(r, mapping.extra1);
      if (val != null && String(val).trim()) {
        const headerName = headers[mapping.extra1] || `Extra 1`;
        dadosExtras[headerName] = String(val).trim();
        hasExtras = true;
        console.log(`🔍 [FRONTEND DEBUG] Extra1 encontrado: ${headerName} = ${dadosExtras[headerName]}`);
      }
    }

    if (mapping.extra2 != null) {
      const val = safeIndex(r, mapping.extra2);
      if (val != null && String(val).trim()) {
        const headerName = headers[mapping.extra2] || `Extra 2`;
        dadosExtras[headerName] = String(val).trim();
        hasExtras = true;
        console.log(`🔍 [FRONTEND DEBUG] Extra2 encontrado: ${headerName} = ${dadosExtras[headerName]}`);
      }
    }

    if (mapping.extra3 != null) {
      const val = safeIndex(r, mapping.extra3);
      if (val != null && String(val).trim()) {
        const headerName = headers[mapping.extra3] || `Extra 3`;
        dadosExtras[headerName] = String(val).trim();
        hasExtras = true;
        console.log(`🔍 [FRONTEND DEBUG] Extra3 encontrado: ${headerName} = ${dadosExtras[headerName]}`);
      }
    }

    if (hasExtras) {
      c.dados_extras = dadosExtras;
      // Log apenas dos primeiros 3 contatos para não poluir o console
      if (contacts.length < 3) {
        console.log(`🔍 [FRONTEND DEBUG] Contato ${contacts.length + 1} com dados extras:`, c);
      }
    }

    if (c.name || c.phone) contacts.push(c);
  }
  
  console.log(`🔍 [FRONTEND DEBUG] Total de contatos processados: ${contacts.length}`);
  console.log(`🔍 [FRONTEND DEBUG] Contatos com dados extras: ${contacts.filter(c => c.dados_extras).length}`);
  
  return contacts;
}

// Converte linhas em objetos completos, mapeando cada coluna para uma chave derivada do header
function makeUniqueKeys(headers: string[]): string[] {
  const seen = new Map<string, number>();
  const keyify = (h: string, idx: number) => {
    const base = (h || `Coluna ${idx + 1}`)
      .toString()
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s_\-]+/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '') || `col_${idx + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  };
  return headers.map((h, i) => keyify(h, i));
}

export function rowsToObjects(headers: string[], bodyRows: string[][]): Array<Record<string, string>> {
  const keys = makeUniqueKeys(headers || []);
  const records: Array<Record<string, string>> = [];
  for (const row of bodyRows || []) {
    const obj: Record<string, string> = {};
    for (let i = 0; i < keys.length; i++) {
      obj[keys[i]] = row?.[i] != null ? String(row[i]) : '';
    }
    records.push(obj);
  }
  return records;
}

export async function analyzeFile(file: File): Promise<CSVAnalysis> {
  const rows = await parseFileToRows(file);
  const { headers, preview, totalRows, bodyRows, limitExceeded } = buildPreviewFromRows(rows);
  const mapping = suggestColumnMapping(headers, bodyRows);
  return { headers, preview, totalRows, bodyRows, mapping, limitExceeded };
}
