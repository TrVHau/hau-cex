import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Sinh secret ngẫu nhiên 20 bytes được encode chuẩn Base32 (RFC 4648) */
export function generateBase32Secret(byteLength = 20): string {
  const bytes = randomBytes(byteLength);
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/** Decode chuỗi Base32 thành Buffer */
export function decodeBase32(input: string): Buffer {
  const normalized = input.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of normalized) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) {
      throw new Error('Invalid Base32 secret character');
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

/** Sinh mã OTP 6 chữ số theo RFC 6238 (SHA-1, bước 30s) cho counter cụ thể */
function generateTotpAtCounter(secret: Buffer, counter: number): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', secret).update(counterBuf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binaryCode =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = binaryCode % 1_000_000;
  return otp.toString().padStart(6, '0');
}

/** Xác thực mã TOTP 6 chữ số với độ lệch cửa sổ ±windowSteps (mặc định ±30s) */
export function verifyTotpCode(
  base32Secret: string,
  code: string,
  windowSteps = 1,
): boolean {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) return false;

  let secretBuf: Buffer;
  try {
    secretBuf = decodeBase32(base32Secret);
  } catch {
    return false;
  }

  const currentStep = Math.floor(Date.now() / 1000 / 30);
  const targetBuf = Buffer.from(trimmed, 'utf8');

  for (let offset = -windowSteps; offset <= windowSteps; offset++) {
    const candidate = generateTotpAtCounter(secretBuf, currentStep + offset);
    const candidateBuf = Buffer.from(candidate, 'utf8');
    if (
      candidateBuf.length === targetBuf.length &&
      timingSafeEqual(candidateBuf, targetBuf)
    ) {
      return true;
    }
  }

  return false;
}

/** Tạo otpauth:// URI tương thích Google Authenticator / Authy */
export function buildOtpAuthUri(
  secret: string,
  accountEmail: string,
  issuer = 'HAU-CEX',
): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountEmail)}`;
  return `otpauth://totp/${label}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
