
import { DailySaleRecord, EventProduct } from '../types';
import * as XLSX from 'xlsx';

export class FileProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileProcessingError';
  }
}

const normalizeDate = (val: string): string => {
  if (!val) return '';
  const clean = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const dmyMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const [_, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const ymdMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const [_, y, m, d] = ymdMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{8}$/.test(clean)) {
    return `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
  }
  return clean;
};

const normalizeHeader = (h: any): string => {
  if (h === null || h === undefined) return '';
  return String(h)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
};

const cleanValue = (val: any): string => {
  if (val === null || val === undefined || val === "") return '';
  if (typeof val === 'number') {
    return val.toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: 0 });
  }
  const str = String(val).trim();
  if (str.toLowerCase().includes('e+')) {
    const num = Number(str);
    if (!isNaN(num)) return num.toLocaleString('fullwide', { useGrouping: false, maximumFractionDigits: 0 });
  }
  return str;
};

export const parseEventExcel = (data: ArrayBuffer): EventProduct[] => {
  try {
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    if (!rows || rows.length === 0) throw new FileProcessingError("File Excel này trống.");

    const KEYWORDS = {
      barcode: ['barcode', 'mavach', 'mahang', 'code', 'id', 'upc', 'ean', 'sku', 'masp', 'mabarcode', 'ma'],
      name: ['tensanpham', 'itemname', 'productname', 'tenhang', 'name', 'tensp', 'description', 'desc', 'tenhanghoa', 'ten'],
      layer: ['layer', 'level', 'nhom', 'nhomhang', 'phanloai', 'category', 'cat', 'group', 'class', 'loai', 'loaihang', 'nganhhang']
    };

    let headerRowIdx = -1;
    let colMap = { layer: -1, barcode: -1, itemName: -1 };

    for (let r = 0; r < Math.min(rows.length, 100); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      const normalizedRow = row.map(cell => normalizeHeader(cell));
      const bIdx = normalizedRow.findIndex(h => KEYWORDS.barcode.some(k => h === k || h.includes(k)));
      const nIdx = normalizedRow.findIndex(h => KEYWORDS.name.some(k => h === k || h.includes(k)));
      if (bIdx !== -1 && nIdx !== -1) {
        headerRowIdx = r;
        colMap = { barcode: bIdx, itemName: nIdx, layer: -1 };
        break;
      }
    }

    const result: EventProduct[] = [];
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const barcode = cleanValue(row[colMap.barcode]);
      const itemName = cleanValue(row[colMap.itemName]);
      if (barcode) {
        result.push({ event_name: "", start_date: "", end_date: "", barcode, item_name: itemName || "Không tên" });
      }
    }
    return result;
  } catch (error) {
    throw new FileProcessingError("Lỗi đọc file Excel danh mục.");
  }
};
