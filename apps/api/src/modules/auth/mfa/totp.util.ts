import { createHash, createHmac, randomBytes } from "crypto";

/**
 * Home-grown TOTP (RFC 6238) / HOTP (RFC 4226) — this workspace has no network
 * access to install a package (otplib/speakeasy), so the algorithm is
 * implemented directly on Node's native `crypto`. Compatible with any
 * standard authenticator app (Google Authenticator, Microsoft Authenticator,
 * Authy…), which all implement the same RFCs.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;

function base32Encode(buffer: Buffer): string {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder > 0) {
    const lastChunk = bits.slice(bits.length - remainder).padEnd(5, "0");
    output += BASE32_ALPHABET[parseInt(lastChunk, 2)];
  }
  return output;
}

function base32Decode(secret: string): Buffer {
  const cleaned = secret.toUpperCase().replace(/=+$/, "").replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/** A fresh random shared secret, base32-encoded for both storage and display/QR provisioning. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function buildOtpauthUrl(secretBase32: string, accountEmail: string, issuer = "IXORIS"): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function hotp(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function generateTotp(secretBase32: string, forTimeMs: number = Date.now()): string {
  const counter = Math.floor(forTimeMs / 1000 / TOTP_PERIOD_SECONDS);
  return hotp(secretBase32, counter);
}

/** Accepts a code from the current or an adjacent 30s step, to tolerate clock drift. */
export function verifyTotp(secretBase32: string, token: string, window = 1): boolean {
  const cleanToken = token.trim();
  if (!/^\d{6}$/.test(cleanToken)) return false;

  const counter = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
  for (let offset = -window; offset <= window; offset++) {
    if (hotp(secretBase32, counter + offset) === cleanToken) return true;
  }
  return false;
}

const BACKUP_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I — avoids transcription errors

function randomBackupCode(): string {
  const bytes = randomBytes(8);
  let raw = "";
  for (const byte of bytes) raw += BACKUP_CODE_ALPHABET[byte % BACKUP_CODE_ALPHABET.length];
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, randomBackupCode);
}

/** Normalizes case/dashes before hashing so a code hashes the same way whether or not the user retypes the dash. */
export function hashBackupCode(code: string): string {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}
