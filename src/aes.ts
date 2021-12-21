import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from 'crypto';

export function encrypt(content: Uint8Array, masterKey: Uint8Array) {
  // random initialization vector
  const iv = randomBytes(16);

  // random salt
  const salt = randomBytes(64);

  // generate key
  const key = pbkdf2Sync(masterKey, salt, 2145, 32, 'sha512');

  // AES 256 GCM Mode
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  // encrypt the given text
  const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);

  // extract the auth tag
  const tag = cipher.getAuthTag();

  // generate output
  return Buffer.concat([salt, iv, tag, encrypted]);
}

export function decrypt(encData: Uint8Array, masterKey: Uint8Array) {
  // get salt, iv, tag, content
  const salt = encData.slice(0, 64); // 64
  const iv = encData.slice(64, 80); // 16
  const tag = encData.slice(80, 96); // 16
  const content = encData.slice(96);

  // derive key using; 32 byte key length
  const key = pbkdf2Sync(masterKey, salt, 2145, 32, 'sha512');

  // AES 256 GCM Mode
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  // decrypt the given text
  const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);

  return decrypted;
}
