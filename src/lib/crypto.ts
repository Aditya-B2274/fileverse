import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_HEX = process.env.ENCRYPTION_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const KEY = Buffer.from(KEY_HEX.padEnd(64, "0").substring(0, 64), "hex");

export function encrypt(buffer: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]);
}

export function decrypt(combined: Buffer): Buffer {
  if (combined.length < 28) {
    throw new Error("Invalid encrypted buffer length");
  }

  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(12, 28);
  const encrypted = combined.subarray(28);

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
