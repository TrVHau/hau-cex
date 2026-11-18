import Decimal from 'decimal.js';

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
    // số chữ số sau dấu phẩy theo tickSize
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

/** Parse error message từ backend response */
export function parseApiError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Đã xảy ra lỗi không xác định';
  const e = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string') return msg;
  if (typeof e?.message === 'string') return e.message;
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
