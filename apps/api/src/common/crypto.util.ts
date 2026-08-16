import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'crypto';

/**
 * Derives a 32-byte key for AES-256-GCM strictly from OAUTH_ENCRYPTION_SECRET.
 * SHA-256 hash digests the secret into the exact 256-bit (32-byte) key buffer required by AES-256-GCM.
 *
 * SECURITY RULE:
 * - NO fallback to JWT_PRIVATE_KEY allowed (crypto key isolation).
 * - Fails closed if OAUTH_ENCRYPTION_SECRET is missing (except test environment fallback).
 */
export function getEncryptionKey(overrideSecret?: string): Buffer {
  const secret =
    overrideSecret ||
    process.env.OAUTH_ENCRYPTION_SECRET ||
    (process.env.NODE_ENV === 'test'
      ? 'devos_dedicated_oauth_encryption_secret_for_unit_tests_32bytes!'
      : undefined);

  if (!secret) {
    throw new Error(
      'FATAL CONFIGURATION ERROR: OAUTH_ENCRYPTION_SECRET environment variable is missing.',
    );
  }

  return createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a sensitive OAuth plaintext token using AES-256-GCM authenticated encryption.
 * Generates a unique, random 12-byte IV per invocation to ensure identical plaintexts produce distinct ciphertexts.
 * Returns formatted ciphertext string: `enc:${ivHex}:${authTagHex}:${ciphertextHex}`.
 */
export function encryptToken(
  plaintext: string | null | undefined,
  overrideSecret?: string,
): string | null {
  if (!plaintext || typeof plaintext !== 'string' || !plaintext.trim()) {
    return null;
  }

  const key = getEncryptionKey(overrideSecret);
  const iv = randomBytes(12); // 12-byte IV for AES-256-GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext.trim(), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM formatted ciphertext string.
 * Validates GCM authentication tag; throws error if ciphertext or key has been tampered with.
 * Returns the original plaintext token.
 */
export function decryptToken(
  ciphertext: string | null | undefined,
  overrideSecret?: string,
): string | null {
  if (!ciphertext || typeof ciphertext !== 'string' || !ciphertext.trim()) {
    return null;
  }

  // Legacy fallback if unencrypted token exists
  if (!ciphertext.startsWith('enc:')) {
    return ciphertext;
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted token format');
  }

  const [, ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey(overrideSecret);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
