import Decimal from 'decimal.js';
import type { DepositStatus } from '../types';

/**
 * Format một giá trị tài chính với đúng precision.
 * KHÔNG bao giờ dùng JS number cho balance/price/qty — dùng hàm này.
 */
export function formatDecimal(value: string | null | undefined, precision = 8): string {
  if (value === null || value === undefined || value === '') return '—';
  try {
    return new Decimal(value).toFixed(precision);
  } catch {
    return '—';
  }
}

export function formatPrice(value: string | null | undefined, tickSize = '0.01'): string {
  if (value === null || value === undefined || value === '') return '—';
  try {
    const d = new Decimal(value);
    const decimals = new Decimal(tickSize).decimalPlaces();
    return d.toFixed(decimals);
  } catch {
    return '—';
  }
}

export function formatQty(value: string | null | undefined, precision = 8): string {
  return formatDecimal(value, precision);
}

/** So sánh hai Decimal string */
export function decimalGt(a: string, b: string): boolean {
  try {
    return new Decimal(a).gt(new Decimal(b));
  } catch {
    return false;
  }
}

export function decimalAdd(a: string, b: string): string {
  try {
    return new Decimal(a).add(new Decimal(b)).toFixed();
  } catch {
    return '0';
  }
}

/** Parse error message từ backend response (hỗ trợ cả NestJS HttpException lẫn custom { error: { code, message } }) */
export function parseApiError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Đã xảy ra lỗi không xác định';
  const e = error as {
    response?: {
      data?: {
        message?: string | string[];
        error?: { code?: string; message?: string };
      };
    };
    message?: string;
  };
  const customMsg = e?.response?.data?.error?.message;
  if (typeof customMsg === 'string' && customMsg.trim()) return customMsg;
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (typeof e?.message === 'string' && e.message.trim()) return e.message;
  return 'Đã xảy ra lỗi không xác định';
}

/** Tạo idempotency key ngẫu nhiên */
export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Format thời gian ngắn gọn */
export function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString('vi-VN');
}

/** Export dữ liệu ra file CSV trên trình duyệt */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): void {
  const escapeCell = (cell: string | number | null | undefined): string => {
    const raw = cell === null || cell === undefined ? '' : String(cell);
    const escaped = raw.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ];

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Map DepositStatus sang label và class CSS đồng bộ */
export function getDepositStatusMeta(status: DepositStatus): { label: string; className: string } {
  switch (status) {
    case 'CREDITED':
      return { label: 'CREDITED', className: 'bg-[#0ecb81]/15 text-[#0ecb81] border-[#0ecb81]/30' };
    case 'CONFIRMING':
    case 'DETECTED':
      return { label: status, className: 'bg-[#3b82f6]/15 text-[#60a5fa] border-[#3b82f6]/30' };
    case 'PENDING':
      return { label: 'PENDING', className: 'bg-[#f5b642]/15 text-[#f5b642] border-[#f5b642]/30' };
    case 'FAILED':
      return { label: 'FAILED', className: 'bg-[#f6465d]/15 text-[#f6465d] border-[#f6465d]/30' };
    case 'EXPIRED':
    default:
      return { label: status, className: 'bg-[#848e9c]/15 text-[#848e9c] border-[#848e9c]/30' };
  }
}
