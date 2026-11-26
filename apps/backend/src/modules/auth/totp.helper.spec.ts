import { createHmac } from 'node:crypto';
import {
  buildOtpAuthUri,
  decodeBase32,
  generateBase32Secret,
  verifyTotpCode,
} from './totp.helper';

function computeTotpForStep(base32Secret: string, step: number): string {
  const secretBuf = decodeBase32(base32Secret);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', secretBuf).update(counterBuf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binaryCode =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (binaryCode % 1_000_000).toString().padStart(6, '0');
}

describe('totp.helper', () => {
  it('generates valid base32 secret that decodes to requested bytes', () => {
    const secret = generateBase32Secret(20);
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(decodeBase32(secret).length).toBe(20);
  });

  it('builds standard otpauth URI for Google Authenticator', () => {
    const uri = buildOtpAuthUri('JBSWY3DPEHPK3PXP', 'alice@hau.edu.vn');
    expect(uri).toContain('otpauth://totp/HAU-CEX:alice%40hau.edu.vn');
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('issuer=HAU-CEX');
  });

  it('verifies current and +/-1 window step TOTP codes and rejects invalid ones', () => {
    const secret = generateBase32Secret(20);
    const currentStep = Math.floor(Date.now() / 1000 / 30);

    const validNow = computeTotpForStep(secret, currentStep);
    const validPrev = computeTotpForStep(secret, currentStep - 1);
    const invalidFar = computeTotpForStep(secret, currentStep + 5);

    expect(verifyTotpCode(secret, validNow)).toBe(true);
    expect(verifyTotpCode(secret, validPrev)).toBe(true);
    expect(verifyTotpCode(secret, invalidFar)).toBe(false);
    expect(verifyTotpCode(secret, 'abc123')).toBe(false);
    expect(verifyTotpCode(secret, '12345')).toBe(false);
  });
});
